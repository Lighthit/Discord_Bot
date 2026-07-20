import "dotenv/config"
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags, AttachmentBuilder } from 'discord.js';
import { writeFile, rename, readFile, access } from 'fs/promises';
import path, { join, resolve, sep } from "path";
import { z } from 'zod';
import { readFileSync } from 'fs';

//AI Agent && AI tools && AI Skills
import { OpenRouter } from '@openrouter/agent';
import { checkCertificatesTool } from '../AI/tools-ai/certificate-check.js';
import { manageCertFileTool } from '../AI/tools-ai/ManageCertList.js';
import { getCurrentDateTool } from '../AI/tools-ai/date-time.js';

// PDF generator (ที่ทำไว้ก่อนหน้า)
import { generatePdfBufferFromMarkdown } from "../AI/buffer/generatePdfFromMarkdown.js";
export const Chatbot = {
    data: new SlashCommandBuilder()
        .setName('chatbot')
        .setDescription('คุยกับเจ้าเบ๊ Paimon ว่าอยากให้มันทำอะไรกะนะ ?')
        .addStringOption(option =>
            option
                .setName('message')
                .setDescription('ข้อความที่ต้องการจะคุย')
                .setRequired(true)
        ),

    async execute(interaction, userData) {
        const skillContent = readFileSync('./AI/skill/persona.md', 'utf-8');
        const Persona_response = readFileSync('./AI/skill/tools-routing.md', 'utf-8');
        const message = interaction.options.getString('message');

        await interaction.deferReply();
        try {
            const openrouter = new OpenRouter({
                apiKey: userData.AI_api_Keys,
            });

            const result = await openrouter.callModel({
                model: userData.AI_Model,
                input: [
                    { role: 'system', content: Persona_response },
                    { role: 'system', content: skillContent },
                    { role: 'user', content: `${message} with id ${userData.id}` },
                ],
                tools: [checkCertificatesTool, manageCertFileTool, getCurrentDateTool],
            });

            const Answer_Ai = await result.getText();

            if (Answer_Ai.length > 1900) {
                // ยาวเกิน limit ของ discord -> ส่งทั้ง .md (ต้นฉบับ) และ .pdf (render แล้ว)
                const pdfBuffer = await generatePdfBufferFromMarkdown(Answer_Ai, { enableToc: true });
                const mdBuffer = Buffer.from(Answer_Ai, 'utf-8');

                const mdAttachment = new AttachmentBuilder(mdBuffer, { name: 'answer.md' });
                const pdfAttachment = new AttachmentBuilder(pdfBuffer, { name: 'answer.pdf' });

                await interaction.editReply({
                    content: 'คำตอบยาวไปมันมากกว่า 2000 text discord ไม่รองรับง่า เจ้าไพม่อนเลยทำเป็นไฟล์ให้แทนนะ 📄',
                    files: [pdfAttachment, mdAttachment],
                });

            } else {
                await interaction.editReply(Answer_Ai);
            }

        } catch (err) {
            console.error(err);
            await interaction.editReply('เกิดข้อผิดพลาดตอนคุยกับ AI 😢 ลองทักหา เจ้าผู้สร้างไพม่อนสิ HEHE');
        }
    },
};