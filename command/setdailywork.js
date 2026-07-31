import { SlashCommandBuilder, EmbedBuilder ,MessageFlags } from 'discord.js';
import { activateCronJob, loadCronJob } from './Daily_noti.js';

export const data = new SlashCommandBuilder()
  .setName('setdailywork')
  .setDescription('ตั้งเวลาและคำสั่ง AI ให้ cron job ที่สร้างไว้ด้วย /opendailywork')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('ชื่อ cron job ที่สร้างไว้ (ดูได้จาก /listdailywork)')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('schedule')
      .setDescription('cron expression เช่น "0 9 * * *" (ทุกวัน 9 โมงเช้า)')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('prompt')
      .setDescription('คำสั่ง/prompt ที่จะให้ AI ตอบ แล้วเอาคำตอบไป DM ให้')
      .setRequired(true)
  );

export async function execute(interaction, userData) {
  const cronName = interaction.options.getString('name').trim().toLowerCase();
  const schedule = interaction.options.getString('schedule');
  const prompt = interaction.options.getString('prompt');

  const existing = loadCronJob(userData.id, cronName);
  if (!existing) {
    await interaction.reply({
      content: `❌ ไม่พบ cron ชื่อ \`${cronName}\` กรุณาสร้างก่อนด้วย \`/opendailywork\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const updated = activateCronJob(interaction.client, userData.id, cronName, {
      schedule,
      message: prompt,
      userData,
    });

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle('✅ ตั้งเวลา Cron Job สำเร็จ')
      .addFields(
        { name: 'ชื่อ', value: updated.name, inline: true },
        { name: 'Schedule', value: `\`${updated.schedule}\``, inline: true },
        { name: 'สถานะ', value: 'เปิดใช้งานแล้ว ✅', inline: true },
        { name: 'Prompt', value: updated.message }
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  } catch (err) {
    await interaction.reply({
      content: `❌ ตั้งค่าไม่สำเร็จ: ${err.message}`,
      flags: MessageFlags.Ephemeral
    });
  }
}