import "dotenv/config"
import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { generatePdfBufferFromMarkdown } from "../AI/buffer/generatePdfFromMarkdown.js";
import { MainAgents } from "../AI/agents/LLMS-main.js";

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
        const message = interaction.options.getString('message');
        const attachment = interaction.options.getAttachment('file');

        await interaction.deferReply();

        try {
            const { answer: Answer_Ai, vaultAttachments } = await MainAgents({
                userData,
                sessionKey: interaction,
                message,
                attachment,
            });

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