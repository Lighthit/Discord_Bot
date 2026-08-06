import { SlashCommandBuilder, EmbedBuilder , MessageFlags} from 'discord.js';
import { listCronJobs } from './Daily_noti.js';
import { hasCronTask } from './Crontab/Manager.js'; // ปรับ path ให้ตรงกับตำแหน่งไฟล์จริง

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
          // เช็คสถานะจริงจาก cronManager (มี task รันอยู่ในหน่วยความจำไหม)
          // แทนที่จะเชื่อ job.enabled จากไฟล์เพียวๆ เพราะอาจ desync ได้
          // เช่นตอนบอท restart แล้ว restore task ไม่สำเร็จ
          const isRunning = hasCronTask(userData.id, job.name);

          let status;
          if (isRunning) {
            status = '🟢 เปิดใช้งาน รอเวลา run';
          } else if (job.enabled) {
            // ไฟล์บอกว่า enabled แต่ไม่มี task จริงรันอยู่ -> แจ้งเตือนผู้ใช้
            status = '🔴 ควรเปิดใช้งานแต่ไม่มี task รันอยู่ (ลอง /setdailywork ใหม่)';
          } else {
            status = '⚪ ยังไม่เปิดใช้งาน';
          }

          const schedule = job.schedule ? `\`${job.schedule}\`` : '_ยังไม่ตั้งเวลา_';
          return `**${job.name}** — ${status}\nเวลา: ${schedule}\nID: \`${job.id}\``;
        })
        .join('\n\n')
    );

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral, });
}