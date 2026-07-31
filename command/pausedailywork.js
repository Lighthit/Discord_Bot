import { SlashCommandBuilder , MessageFlags } from 'discord.js';
import { deactivateCronJob, loadCronJob } from './Daily_noti.js';

export const data = new SlashCommandBuilder()
  .setName('pausedailywork')
  .setDescription('หยุด cron job ชั่วคราว (ไม่ลบ ตั้งใหม่ได้ทีหลังด้วย /setdailywork)')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('ชื่อ cron job ที่ต้องการหยุด (ดูได้จาก /listdailywork)')
      .setRequired(true)
  );

export async function execute(interaction, userData) {
  const cronName = interaction.options.getString('name').trim().toLowerCase();

  const existing = loadCronJob(userData.id, cronName);
  if (!existing) {
    await interaction.reply({
      content: `❌ ไม่พบ cron ชื่อ \`${cronName}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  deactivateCronJob(userData.id, cronName);

  await interaction.reply({
    content: `⏸️ หยุด cron \`${cronName}\` ชั่วคราวแล้ว (ตั้งใหม่ได้ด้วย \`/setdailywork\`)`,
    flags: MessageFlags.Ephemeral,
  });
}