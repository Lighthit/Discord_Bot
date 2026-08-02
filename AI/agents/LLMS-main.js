import { readFileSync } from 'fs';
import axios from 'axios';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path, { join } from 'path';
import { AttachmentBuilder } from 'discord.js';

import { OpenRouter } from '@openrouter/agent';
import { checkCertificatesTool } from '../tools-ai/certificate-check.js';
import { manageCertFileTool } from '../tools-ai/ManageCertList.js';
import { getCurrentDateTool } from '../tools-ai/date-time.js';
import { getHistory, appendMessages } from '../session/sessionManager.js';
import { memoryVaultTool } from "../tools-ai/memory_vault.js";
import { webSearchTool } from "../tools-ai/web-search.js";
import { fileVaultTool, runFileVaultAction, readVaultFileBuffer } from "../tools-ai/file_vault.js";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_VAULT_ATTACHMENT_BYTES = 8 * 1024 * 1024; // discord จำกัดไฟล์แนบ ~8-10MB (ตาม tier ของ server)



async function getGenerationWithRetry(id, apiKey) {
  const maxRetry = 10;

  for (let i = 0; i < maxRetry; i++) {
    try {
      const res = await axios.get(
        "https://openrouter.ai/api/v1/generation",
        {
          params: { id },
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        }
      );

      return res.data;

    } catch (err) {
      if (err.response?.status === 404) {
        console.log(`Generation not ready, retry ${i + 1}/${maxRetry}`);

        await new Promise(resolve =>
          setTimeout(resolve, 2000)
        );

        continue;
      }

      throw err;
    }
  }

  throw new Error("Generation still not available");
}


/* =========================================================
 * เซฟไฟล์ที่ user แนบมาใน discord ลง file_vault จริง ๆ
 *
 * คืนค่าเสมอในรูปแบบเดียวกับ fileVaultTool.execute()
 * คือ { ok, error, ... } ไม่ใช้ field "reason" แยกอีกชุด
 * เพื่อให้ผู้เรียกเช็คแค่ .ok / .error พอ
 * ========================================================= */
async function saveAttachmentToVault(uniqueId, attachment) {

    if (attachment.size > MAX_ATTACHMENT_BYTES) {
        return { ok: false, error: "ไฟล์ใหญ่เกิน 20MB" };
    }

    const res = await fetch(attachment.url);
    if (!res.ok) {
        return { ok: false, error: `ดาวน์โหลดไฟล์ไม่สำเร็จ (HTTP ${res.status})` };
    }

    const buffer = Buffer.from(await res.arrayBuffer());

    // fileVaultTool.execute ต้องการ source_path (ไฟล์บน disk) เลยเขียนลง temp ก่อน
    const tmpDir = await mkdtemp(join(tmpdir(), "vault-upload-"));
    const tmpPath = join(tmpDir, attachment.name);
    await writeFile(tmpPath, buffer);

    try {
        // ผลลัพธ์ตรงกับ outputSchema ของ file_vault.js เป๊ะ ๆ
        // { ok, action, path, filename, mime, size, hash, metadata, files, count, error }
        // เรียก runFileVaultAction ตรง ๆ แทน fileVaultTool.execute
        // เพราะ tool() เป็น wrapper สำหรับ agent loop เท่านั้น
        // ไม่ได้รับประกันว่า .execute จะเป็น function ที่เรียกตรงได้
        return await runFileVaultAction({
            unique_id: uniqueId,
            action: "upload",
            source_path: tmpPath,
            filename: attachment.name,
            title: attachment.name,
            description: `แนบมาจาก Discord โดยผู้ใช้ ${uniqueId}`,
        });
    } finally {
        await unlink(tmpPath).catch(() => {});
    }

}

/* =========================================================
 * ดึง tool call ของ file_vault + ผลลัพธ์ที่มันคืนมาในเทิร์นนี้
 * แล้วอ่านไฟล์จาก disk มาแนบกลับ discord
 *
 * ยืนยันจาก runtime dump จริงแล้วว่า ModelResult มี property
 * "allToolExecutionRounds" ซึ่งเป็น array ของแต่ละรอบการเรียก tool:
 *   { round, toolCalls: [...], response: {...}, toolResults: [...] }
 * แต่ละ toolResults[] มีรูปแบบ { toolCallId, toolName, result, error? }
 * — toolName กับ result (= ค่าที่ execute() คืนมา) อยู่ในก้อนเดียวกันเลย
 * ไม่ต้อง join เองผ่าน getItemsStream()/getNewMessagesStream() อีกต่อไป
 *
 * NOTE: allToolExecutionRounds ไม่ได้อยู่ในหน้า public API
 * reference ของ @openrouter/agent (เป็น internal state ที่เห็นจาก
 * console.log ตรง ๆ) — SDK ยังเป็น beta อาจเปลี่ยน shape ได้ใน
 * เวอร์ชันหน้า ถ้าพังให้ console.log(result) ดูโครงสร้างใหม่อีกที
 * ========================================================= */

async function collectVaultAttachmentsFromResult(uniqueId, result) {
    const attachments = [];
    const addedFiles = new Set();

    const rounds = result.allToolExecutionRounds ?? [];

    for (const round of rounds) {
        const toolMap = new Map();

        for (const call of round.toolCalls ?? []) {
            toolMap.set(call.id, call);
        }

        for (const toolResult of round.toolResults ?? []) {
            const toolCall = toolMap.get(toolResult.callId);

            if (!toolCall) continue;
            if (toolCall.name !== "file_vault") continue;

            let output = toolResult.output;

            if (typeof output === "string") {
                try {
                    output = JSON.parse(output);
                } catch {
                    continue;
                }
            }

            if (!output?.ok) continue;
            if (!output.path || !output.mime) continue;

            // กันซ้ำ
            if (addedFiles.has(output.path)) {
                continue;
            }

            try {
                if (
                    output.size &&
                    output.size > MAX_VAULT_ATTACHMENT_BYTES
                ) {
                    console.warn(`skip ${output.path} because too large`);
                    continue;
                }

                const buffer = await readVaultFileBuffer(
                    uniqueId,
                    output.path
                );

                attachments.push(
                    new AttachmentBuilder(buffer, {
                        name: path.basename(output.path),
                    })
                );

                addedFiles.add(output.path);
            } catch (err) {
                console.error(
                    "read vault file failed",
                    output.path,
                    err
                );
            }
        }
    }

    return attachments;
}

/* =========================================================
 * runChatbot: core logic ทั้งหมดของการคุยกับ AI
 * แยกออกมาเป็นไฟล์ต่างหากจาก discord command เพื่อให้เรียกใช้
 * จากที่อื่นได้ด้วย (message handler, cron, command อื่น ๆ)
 *
 * params:
 *   - userData: ข้อมูล user (ต้องมี .id, .AI_api_Keys, .AI_Model)
 *   - sessionKey: ตัวระบุ session สำหรับ getHistory/appendMessages
 *       (ปกติจะส่ง interaction หรือ user id เข้ามา แล้วแต่ระบบ session)
 *   - message: ข้อความจาก user
 *   - attachment: discord Attachment object หรือ null
 *
 * return:
 *   {
 *     answer: string,                         // คำตอบจาก AI (raw text)
 *     vaultAttachments: AttachmentBuilder[],   // ไฟล์จาก vault ที่ AI อ่านมาระหว่าง tool call
 *   }
 * ========================================================= */

export async function MainAgents({ userData, sessionKey, message, attachment }) {
    const skillContent = readFileSync('./AI/skill/persona.md', 'utf-8');
    const Persona_response = readFileSync('./AI/skill/tools-routing.md', 'utf-8');

    const openrouter = new OpenRouter({
        apiKey: userData.AI_api_Keys,
    });

    const history = getHistory(userData, sessionKey);

    let uploadNote = "";

    if (attachment) {
        const saved = await saveAttachmentToVault(userData.id, attachment);
        uploadNote = saved.ok
            ? ` [ผู้ใช้แนบไฟล์ "${saved.filename}" เข้า file_vault แล้ว ที่ path "${saved.path}" ใช้ tool file_vault action "read" ดูได้]`
            : ` [ผู้ใช้พยายามแนบไฟล์ "${attachment.name}" แต่บันทึกไม่สำเร็จ: ${saved.error}]`;
    }

    const userMessage = {
        role: 'user',
        content: `${message} with id ${userData.id}${uploadNote}`,
    };

    const result = await openrouter.callModel({
        model: userData.AI_Model,
        input: [
            { role: 'system', content: Persona_response },
            { role: 'system', content: skillContent },
            ...history,
            userMessage,
        ],
        tools: [checkCertificatesTool, manageCertFileTool, getCurrentDateTool, memoryVaultTool, webSearchTool, fileVaultTool],
    });

    const answer = await result.getText();

    
    // console.log(result);
    //console.dir(result.allToolExecutionRounds, { depth: null });
    // console.log(JSON.stringify(
    //     result.allToolExecutionRounds?.map((r, i) => ({
    //         round: i + 1,
    //         responseId: r.response?.id,
    //         calls: r.toolCalls?.map(c => ({
    //         name: c.name,
    //         args: c.input ?? c.arguments,
    //         })),
    //     })),
    //     null,
    //     2
    //     ));
    const responseIds = result.allToolExecutionRounds
        ?.map(r => r.response?.id)
        .filter(Boolean) ?? [];

    const cost_perUse = [];
    for (const responseId of responseIds) {
        const generation = await getGenerationWithRetry(
            responseId,
            userData.AI_api_Keys
            );  
        // console.log(generation.data.total_cost)  
        cost_perUse.push(generation.data.total_cost)
    }
    const response = await result.getResponse();
    cost_perUse.push(response.usage?.cost ?? 0)
    // console.log(cost_perUse);
    
    const total_cost = cost_perUse.reduce((total, value) => total + value, 0);
    
    appendMessages(userData, sessionKey, [
        userMessage,
        { role: 'assistant', content: answer },
    ]);

    const vaultAttachments = await collectVaultAttachmentsFromResult(userData.id, result);

    return { answer, vaultAttachments , total_cost};
}