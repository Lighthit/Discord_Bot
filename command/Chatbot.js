import "dotenv/config"
import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { readFileSync } from 'fs';
import { writeFile, unlink, mkdtemp } from 'fs/promises';
import { tmpdir } from 'os';
import path, { join } from 'path';

import { OpenRouter } from '@openrouter/agent';
import { checkCertificatesTool } from '../AI/tools-ai/certificate-check.js';
import { manageCertFileTool } from '../AI/tools-ai/ManageCertList.js';
import { getCurrentDateTool } from '../AI/tools-ai/date-time.js';
import { getHistory, appendMessages, clearHistory } from '../AI/session/sessionManager.js';
import { memoryVaultTool } from "../AI/tools-ai/memory_vault.js";
import { webSearchTool } from "../AI/tools-ai/web-search.js";
import { generatePdfBufferFromMarkdown } from "../AI/buffer/generatePdfFromMarkdown.js";
import { fileVaultTool, runFileVaultAction, readVaultFileBuffer } from "../AI/tools-ai/file_vault.js";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_VAULT_ATTACHMENT_BYTES = 8 * 1024 * 1024; // discord จำกัดไฟล์แนบ ~8-10MB (ตาม tier ของ server)

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
    const seenPaths = new Set(); // กันไฟล์เดิมถูกแนบซ้ำ ถ้า AI เรียก read path เดิมหลายรอบ

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

            // เอาเฉพาะผลลัพธ์จาก action "read" เท่านั้น
            // action อื่น (เช่น "upload") ก็มี path/mime เหมือนกัน แต่ไม่ได้ตั้งใจให้แนบกลับ
            if (output.action !== "read") continue;
            if (!output.path || !output.mime) continue;

            if (seenPaths.has(output.path)) continue;
            seenPaths.add(output.path);

            try {
                if (output.size && output.size > MAX_VAULT_ATTACHMENT_BYTES) {
                    console.warn(`skip ${output.path} because too large`);
                    continue;
                }

                const buffer = await readVaultFileBuffer(uniqueId, output.path);

                attachments.push(
                    new AttachmentBuilder(buffer, {
                        name: path.basename(output.path),
                    })
                );
            } catch (err) {
                console.error("read vault file failed", output.path, err);
            }
        }
    }

    return attachments;
}

export const Chatbot = {
    data: new SlashCommandBuilder()
        .setName('chatbot')
        .setDescription('คุยกับเจ้าเบ๊ Paimon ว่าอยากให้มันทำอะไรกะนะ ?')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('ข้อความที่ต้องการจะคุย')
                .setRequired(true)
        )
        .addAttachmentOption(option =>
            option.setName('file')
                .setDescription('ไฟล์แนบที่อยากให้ไพม่อนเก็บเข้า vault ด้วย')
                .setRequired(false)
        ),

    async execute(interaction, userData) {
        const skillContent = readFileSync('./AI/skill/persona.md', 'utf-8');
        const Persona_response = readFileSync('./AI/skill/tools-routing.md', 'utf-8');
        const message = interaction.options.getString('message');
        const attachment = interaction.options.getAttachment('file');

        await interaction.deferReply();

        try {
            const openrouter = new OpenRouter({
                apiKey: userData.AI_api_Keys,
            });

            const history = getHistory(userData, interaction);

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

            const Answer_Ai = await result.getText();

            // === TEMP DEBUG — ลบทิ้งหลัง debug เสร็จ ===
            // ดูให้ชัดว่า tool call เกิดขึ้นจริงในเทิร์นนี้ไหม
            // และ toolResults[] แต่ละตัวหน้าตาเป็นยังไงกันแน่
            // console.log("=== DEBUG allToolExecutionRounds ===");
            // console.log(
            //     "rounds count:",
            //     result.allToolExecutionRounds?.length ?? "undefined/no property"
            // );
            // console.log(
            //     JSON.stringify(result.allToolExecutionRounds, null, 2)
            // );
            // console.log("=== END DEBUG ===");

            appendMessages(userData, interaction, [
                userMessage,
                { role: 'assistant', content: Answer_Ai },
            ]);

            // ดึงไฟล์จาก vault ที่ AI เรียกดูมาระหว่าง tool call ในเทิร์นนี้
            // แล้วส่งกลับ discord (ใช้ getNewMessagesStream ไม่ใช่ result.toolCalls
            // ที่ไม่มีอยู่จริงใน @openrouter/agent)
            const vaultAttachments = await collectVaultAttachmentsFromResult(
                userData.id,
                result
            );

            if (Answer_Ai.length > 1900) {
                const pdfBuffer = await generatePdfBufferFromMarkdown(Answer_Ai, { enableToc: true });
                const mdBuffer = Buffer.from(Answer_Ai, 'utf-8');

                const mdAttachment = new AttachmentBuilder(mdBuffer, { name: 'answer.md' });
                const pdfAttachment = new AttachmentBuilder(pdfBuffer, { name: 'answer.pdf' });

                await interaction.editReply({
                    content: 'คำตอบยาวไปมันมากกว่า 2000 text discord ไม่รองรับง่า เจ้าไพม่อนเลยทำเป็นไฟล์ให้แทนนะ 📄',
                    files: [pdfAttachment, mdAttachment, ...vaultAttachments],
                });

            } else {
                await interaction.editReply({
                    content: Answer_Ai,
                    files: vaultAttachments.length ? vaultAttachments : undefined,
                });
            }

        } catch (err) {
            console.error(err);
            await interaction.editReply('เกิดข้อผิดพลาดตอนคุยกับ AI 😢 ลองทักหา เจ้าผู้สร้างไพม่อนสิ HEHE');
        }
    },
};
