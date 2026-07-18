import "dotenv/config"
import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { writeFile, rename, readFile, access } from 'fs/promises';
import path, { join, resolve, sep } from "path";
import { z } from 'zod';
import { readFileSync } from 'fs';

//AI Agent && AI tools && AI Skills
import { OpenRouter } from '@openrouter/agent';
import { checkCertificatesTool } from '../AI/tools-ai/certificate-check.js';
import { manageCertFileTool } from '../AI/tools-ai/ManageCertList.js';
import { getCurrentDateTool } from '../AI/tools-ai/date-time.js';



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

    async execute(interaction,userData) {
        const skillContent = readFileSync('./AI/skill/tools-routing.md', 'utf-8');
        const message = interaction.options.getString('message');

        await interaction.deferReply(); // ต้อง defer ก่อนเรียก AI เพราะ Discord ให้เวลาแค่ 3 วิ
        try {
            const openrouter = new OpenRouter({
                apiKey: userData.AI_api_Keys,
            });

            const result = await openrouter.callModel({
                model: userData.AI_Model,
                input: [
                    { role: 'system', content: skillContent },
                    { role: 'user', content: `${message} with id ${userData.id}` },
                ],
                tools: [checkCertificatesTool, manageCertFileTool, getCurrentDateTool],
            });

            const Answer_Ai = await result.getText();
            await interaction.editReply(Answer_Ai); // editReply ตัว R ใหญ่

        } catch (err) {
            console.error(err);
            await interaction.editReply('เกิดข้อผิดพลาดตอนคุยกับ AI 😢 ลองทักหา เจ้าผู้สร้างไพม่อนสิ HEHE');
        }
        

    },
};

