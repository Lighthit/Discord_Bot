import { SlashCommandBuilder, EmbedBuilder , MessageFlags} from 'discord.js';
import { listCronJobs } from './Daily_noti.js';

export const data = new SlashCommandBuilder()
  .setName('listdailywork')
  .setDescription('ดูรายการ cron job ทั้งหมดของคุณ');

export async function execute(interaction, userData) {
  const jobs = listCronJobs(userData.id);

  if (jobs.length === 0) {
    await interaction.reply({
      content: 'ℹ️ คุณยังไม่มี cron job เลย ลองสร้างด้วย `/opendailywork` ก่อนนะ',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0xfee75c)
    .setTitle('📋 Cron Job ของคุณ')
    .setDescription(
      jobs
        .map((job) => {
          const status = job.enabled ? '🟢 เปิดใช้งาน' : '⚪ ยังไม่เปิดใช้งาน';
          const schedule = job.schedule ? `\`${job.schedule}\`` : '_ยังไม่ตั้งเวลา_';
          return `**${job.name}** — ${status}\nเวลา: ${schedule}\nID: \`${job.id}\``;
        })
        .join('\n\n')
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, });
}