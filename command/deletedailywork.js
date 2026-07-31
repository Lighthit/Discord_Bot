import { SlashCommandBuilder , MessageFlags,} from 'discord.js';
import { deleteCronJob } from './Daily_noti.js';

export const data = new SlashCommandBuilder()
  .setName('deletedailywork')
  .setDescription('ลบ cron job ทิ้งถาวร (หยุดการทำงานด้วย)')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('ชื่อ cron job ที่ต้องการลบ (ดูได้จาก /listdailywork)')
      .setRequired(true)
  );

export async function execute(interaction, userData) {
  const cronName = interaction.options.getString('name').trim().toLowerCase();

  const deleted = deleteCronJob(userData.id, cronName);

  if (!deleted) {
    await interaction.reply({
      content: `❌ ไม่พบ cron ชื่อ \`${cronName}\``,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  await interaction.reply({
    content: `🗑️ ลบ cron \`${cronName}\` เรียบร้อยแล้ว`,
    flags: MessageFlags.Ephemeral,
  });
}