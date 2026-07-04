import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  AttachmentBuilder,
  MessageFlags,
} from "discord.js";

import fs from "fs";
import path from "path";

export async function Signup(interaction) {
  const button = new ButtonBuilder()
    .setCustomId(`SignUp_NewUser&${interaction.user.id}`)
    .setLabel("✨ Sign Up Now")
    .setEmoji("📝")
    .setStyle(ButtonStyle.Success);

  const row = new ActionRowBuilder().addComponents(button);

  // แนบไฟล์รูปจากเครื่อง แล้วตั้งชื่อไฟล์ที่จะอ้างถึง
  const file = new AttachmentBuilder("./images/signup_bg.jpg", {
    name: "signup_bg.jpg",
  });

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle("👋 ยินดีที่ได้รู้จักนะ!")
    .setDescription(
      `สวัสดี **${interaction.user.username}**! ดูเหมือนว่าคุณยังไม่ได้ลงทะเบียนเลยนะ 🥲\nกดปุ่มด้านล่างเพื่อสมัครสมาชิกได้เลย!`
    )
    // ใช้ attachment:// + ชื่อไฟล์ที่ตั้งไว้ด้านบน
    .setImage("attachment://signup_bg.jpg")
    .setThumbnail(interaction.user.displayAvatarURL())
    .setFooter({ text: "กดปุ่มด้านล่างเพื่อเริ่มต้น" })
    .setTimestamp();

  return interaction.reply({
    embeds: [embed],
    components: [row],
    files: [file], // ✅ ต้องแนบไฟล์มาด้วยตรงนี้
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleSignUpButton(interaction) {
    try {
        const folderPath = path.join(process.cwd(), "users_id");
        const filePath = path.join(folderPath, `${interaction.user.id}.json`);
 
        // ถ้ามีไฟล์อยู่แล้ว ไม่ต้องสร้างซ้ำ
        if (fs.existsSync(filePath)) {
            return await interaction.reply({
                content: `⚠️ คุณลงทะเบียนไปแล้วนะ ${interaction.user.username}`,
                flags: MessageFlags.Ephemeral,
            });
        }
 
        const userData = {
            id: interaction.user.id,
            //username: interaction.user.username,
            Last_Chanel_Call:interaction.guild.id,
            Last_Discord_Call:interaction.channel.id,
            joinedAt: new Date().toLocaleString("en-GB", {
                                                          timeZone: "Asia/Bangkok",
                                                        }),
            Last_call: new Date().toLocaleString("en-GB", {
                                                          timeZone: "Asia/Bangkok",
                                                        }) 
        };
 
        fs.writeFileSync(filePath, JSON.stringify(userData, null, 2));
 
        await interaction.reply({
            content: `✅ สมัครสมาชิกสำเร็จแล้ว! ยินดีต้อนรับ ${interaction.user.username} 🎉`,
            flags: MessageFlags.Ephemeral,
        });
    } catch (err) {
        console.error("Signup button error:", err);
        // กันไว้เผื่อ error กลางทาง จะได้ไม่ error ค้าง
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({
                content: "❌ เกิดข้อผิดพลาดในการสมัครสมาชิก ลองใหม่อีกครั้ง พิมพ์ '/paimon' ",
                flags: MessageFlags.Ephemeral,
            });
        }
    }
}