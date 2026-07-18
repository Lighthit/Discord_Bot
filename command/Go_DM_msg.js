import { SlashCommandBuilder, MessageFlags } from "discord.js";

export const GO_DM_MSG = {
    data: new SlashCommandBuilder()
        .setName("get_dm")
        .setDescription("สร้าง DM คุยกับบอทได้ทันทีจากในเซิร์ฟเวอร์"),

    async execute(interaction, userData) {
        try {
            const dmChannel = await interaction.user.createDM();
            await dmChannel.send(`สวัสดีครับ ${interaction.user.username}! นี่คือ DM ที่เปิดจากคำสั่ง /get_dm`);

            await interaction.reply({
                content: "ส่ง DM ให้แล้วนะครับ เช็คกล่องข้อความส่วนตัวได้เลย 📩",
                flags: MessageFlags.Ephemeral,
            });
        } catch (err) {
            console.error("Get_DM command error:", err);
            await interaction.reply({
                content: "ส่ง DM ไม่สำเร็จครับ 😢 อาจเป็นเพราะคุณปิดรับ DM จากสมาชิกเซิร์ฟเวอร์ที่ไม่รู้จักไว้ ลองเปิดใน Privacy Settings ดูนะ",
                flags: MessageFlags.Ephemeral,
            });
        }
    },
};

