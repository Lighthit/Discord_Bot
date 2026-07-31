import { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder , MessageFlags,} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import crypto from 'crypto';
import { MainAgents } from '../AI/agents/LLMS-main.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// เก็บ task ที่กำลังรันอยู่ในหน่วยความจำ (key = `${userId}:${cronName}`)
// ถ้าคุณมี cron manager กลางของบอทอยู่แล้ว แนะนำให้ import instance เดียวกันมาใช้แทนตัวนี้
const activeCronTasks = new Map();

const JOBS_ROOT_DIR = path.join(process.cwd(), 'jobs');

/**
 * คืน path ของโฟลเดอร์ jobs ของ user คนนั้นๆ
 */
function getUserJobsDir(userId) {
  return path.join(JOBS_ROOT_DIR, userId, 'cronjob');
}

/**
 * คืน path ของไฟล์ cron ตาม user + ชื่อ cron
 */
function getCronFilePath(userId, cronName) {
  return path.join(getUserJobsDir(userId), `${cronName}.json`);
}

/**
 * ทำให้ชื่อ cron ปลอดภัยสำหรับใช้เป็นชื่อไฟล์ (กัน path traversal / อักขระแปลกๆ)
 */
function sanitizeCronName(rawName) {
  return rawName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_\-ก-๙]/gi, '_')
    .slice(0, 50);
}

export const data = new SlashCommandBuilder()
  .setName('opendailywork')
  .setDescription('สร้าง cron job สำหรับส่ง auto DM ที่มาจากคำตอบของ AI (ตั้งเวลา/คำสั่ง AI จริงทีหลังได้)')
  .addStringOption((option) =>
    option
      .setName('name')
      .setDescription('ชื่อของ cron job นี้ (ใช้อ้างอิงตอนตั้งเวลา/แก้ไขทีหลัง)')
      .setRequired(true)
  );

export async function execute(interaction, User_info) {
  const userData = User_info; // มาจาก slash command ตามที่ระบุ
  const rawName = interaction.options.getString('name');
  const cronName = sanitizeCronName(rawName);

  if (!cronName) {
    await interaction.reply({
      content: '❌ ชื่อ cron ไม่ถูกต้อง กรุณาลองชื่ออื่น',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const userJobsDir = getUserJobsDir(userData.id);
  const cronFilePath = getCronFilePath(userData.id, cronName);

  // กันชื่อซ้ำ
  if (fs.existsSync(cronFilePath)) {
    await interaction.reply({
      content: `❌ มี cron ชื่อ \`${cronName}\` อยู่แล้ว กรุณาใช้ชื่ออื่น หรือไปแก้ไข job เดิม`,
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // สร้างโฟลเดอร์ ./jobs/{userData.id}/ ถ้ายังไม่มี
  fs.mkdirSync(userJobsDir, { recursive: true });

  const cronId = crypto.randomUUID();

  // โครงสร้างข้อมูล job
  // - id       : ใช้ list/delete/อ้างอิง job นี้
  // - message  : ไม่ใช่ข้อความ DM ตรงๆ แต่เป็น "คำสั่ง/prompt" ที่จะยิงเข้า MainAgents
  //              ตอน cron ทำงาน แล้วเอาคำตอบ AI ไปส่ง DM แทน
  // - schedule/message ใส่เป็นค่าเริ่มต้นไว้ก่อน ตั้งจริงทีหลังผ่าน activateCronJob()
  const cronData = {
    id: cronId,
    name: cronName,
    userId: userData.id,
    guildId: "Direct_msg",
    channelId: "Direct_msg",
    schedule: null, // เช่น '0 9 * * *' — ตั้งทีหลัง
    message: null, // คำสั่ง/prompt ที่จะส่งเข้า AI agent — ตั้งทีหลัง
    enabled: false, // ยังไม่เปิดใช้งานจนกว่าจะตั้ง schedule + message ครบ
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(cronFilePath, JSON.stringify(cronData, null, 2), 'utf-8');

  const embed = new EmbedBuilder()
    .setColor(0x57f287)
    .setTitle('✅ สร้าง Cron Job สำเร็จ')
    .addFields(
      { name: 'ชื่อ', value: cronName, inline: true },
      { name: 'ID', value: cronId, inline: true },
      { name: 'สถานะ', value: 'ยังไม่เปิดใช้งาน (รอตั้งเวลา/คำสั่ง AI)', inline: false }
    )
    .setFooter({ text: `บันทึกไว้ที่ jobs/${userData.id}/cronjob/${cronName}.json` });

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ---- helper functions ให้ไฟล์อื่น import ไปใช้ต่อได้ ----

/**
 * โหลด cron job data จากไฟล์
 */
export function loadCronJob(userId, cronName) {
  const filePath = getCronFilePath(userId, cronName);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/**
 * ลิสต์ cron job ทั้งหมดของ user (ใช้ field `id`/`name` อ้างอิงตอน list/delete)
 */
export function listCronJobs(userId) {
  const dir = getUserJobsDir(userId);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf-8')));
}

/**
 * ลบ cron job ทั้งไฟล์ + หยุด task ที่รันอยู่ (ถ้ามี)
 */
export function deleteCronJob(userId, cronName) {
  const taskKey = `${userId}:${cronName}`;
  if (activeCronTasks.has(taskKey)) {
    activeCronTasks.get(taskKey).stop();
    activeCronTasks.delete(taskKey);
  }
  const filePath = getCronFilePath(userId, cronName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

/**
 * อัปเดต schedule/message(prompt) แล้วเริ่ม (หรือ restart) node-cron task จริง
 * เรียกใช้จากคำสั่งอื่น เช่น /setdailywork
 *
 * @param {import('discord.js').Client} client
 * @param {string} userId
 * @param {string} cronName
 * @param {{schedule: string, message: string, userData: object}} options
 *   - message  : คำสั่ง/prompt ที่จะส่งเข้า MainAgents
 *   - userData : object ผู้ใช้ (shape เดียวกับที่ main.js อ่านจาก users_id/{userId}.json
 *                แล้วส่งเข้า execute(interaction, userData) ตามปกติ)
 *                ผู้เรียก activateCronJob() ต้องส่งเข้ามาเสมอ — ฟังก์ชันนี้ไม่อ่านไฟล์เอง
 */
export function activateCronJob(client, userId, cronName, { schedule, message, userData }) {
  const filePath = getCronFilePath(userId, cronName);
  if (!fs.existsSync(filePath)) {
    throw new Error(`ไม่พบ cron job: ${cronName}`);
  }
  if (!cron.validate(schedule)) {
    throw new Error(`รูปแบบ cron schedule ไม่ถูกต้อง: ${schedule}`);
  }
  if (!userData) {
    throw new Error(`activateCronJob ต้องการ userData (ผู้เรียกต้องส่งมาให้ เช่นจาก main.js)`);
  }

  const cronData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  cronData.schedule = schedule;
  cronData.message = message;
  cronData.enabled = true;
  cronData.updatedAt = new Date().toISOString();
  fs.writeFileSync(filePath, JSON.stringify(cronData, null, 2), 'utf-8');

  const taskKey = `${userId}:${cronName}`;

  // ถ้ามี task เดิมรันอยู่ ให้หยุดก่อน
  if (activeCronTasks.has(taskKey)) {
    activeCronTasks.get(taskKey).stop();
    activeCronTasks.delete(taskKey);
  }

  const task = cron.schedule(schedule, async () => {
    try {
      const discordUser = await client.users.fetch(userId);
      const dmChannel = await (await client.users.fetch(userId)).createDM();
      // ไม่มี interaction จริงตอน cron ทำงาน (ไม่มีคนกดคำสั่ง)
      // จึงใช้ userData ที่ผู้เรียก activateCronJob() ส่งเข้ามาตอนตั้งเวลาแทน (closure ด้านบน)
      // และใช้ค่าคงที่ต่อ cron job เป็น sessionKey
      const sessionKey = {
        guild:{id:"Direct_msg"},
        channel:{id:dmChannel.id},
      };

      const { answer: Answer_Ai, vaultAttachments } = await MainAgents({
        userData,
        sessionKey,
        message: cronData.message, // คำสั่ง/prompt ที่ตั้งไว้ตอนสร้าง/แก้ไข cron
        attachment: undefined,
      });

      if (Answer_Ai) {
        await discordUser.send({ content: Answer_Ai });
      }

      if (vaultAttachments?.length) {
        const files = vaultAttachments.map((att) => new AttachmentBuilder(att.path ?? att));
        await discordUser.send({ files });
      }
    } catch (err) {
      console.error(`[OpenDailywork] ส่ง DM ไม่สำเร็จ (${taskKey}):`, err);
    }
  });

  activeCronTasks.set(taskKey, task);
  return cronData;
}

/**
 * หยุด cron task ที่กำลังรันอยู่ (ไม่ลบไฟล์ ตั้ง enabled = false)
 */
export function deactivateCronJob(userId, cronName) {
  const taskKey = `${userId}:${cronName}`;
  if (activeCronTasks.has(taskKey)) {
    activeCronTasks.get(taskKey).stop();
    activeCronTasks.delete(taskKey);
  }

  const filePath = getCronFilePath(userId, cronName);
  if (fs.existsSync(filePath)) {
    const cronData = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    cronData.enabled = false;
    cronData.updatedAt = new Date().toISOString();
    fs.writeFileSync(filePath, JSON.stringify(cronData, null, 2), 'utf-8');
  }
}

/**
 * โหลด cron ทั้งหมดจากดิสก์แล้วเริ่มรันใหม่ (เรียกตอนบอทเริ่มทำงาน / ready event)
 * ตรงนี้ไม่มี interaction/param จาก main.js ให้ใช้ จึงต้องอ่าน userData จากไฟล์
 * users_id/{userId}.json เอง แล้วค่อยส่งเป็น param เข้า activateCronJob() ตามปกติ
 */
export function restoreAllCronJobs(client) {
  if (!fs.existsSync(JOBS_ROOT_DIR)) return;

  const userDirs = fs.readdirSync(JOBS_ROOT_DIR);
  for (const userId of userDirs) {
    const userDir = path.join(JOBS_ROOT_DIR, userId, 'cronjob');

    // ✅ เช็ค existsSync ก่อน ถ้าไม่มีโฟลเดอร์ cronjob ให้ข้าม user นี้ไปเลย
    if (!fs.existsSync(userDir) || !fs.statSync(userDir).isDirectory()) continue;


    // อ่าน userData ของ user คนนี้จาก users_id/{userId}.json (path เดียวกับ main.js)
    const userFilePath = path.join(process.cwd(), 'users_id', `${userId}.json`);
    let userData;
    try {
      userData = JSON.parse(fs.readFileSync(userFilePath, 'utf-8'));
    } catch (err) {
      console.error(`[OpenDailywork] restore ข้าม user ${userId}: อ่าน userData ไม่ได้`, err);
      continue;
    }

    const files = fs.readdirSync(userDir).filter((f) => f.endsWith('.json'));
    for (const file of files) {
      const cronData = JSON.parse(fs.readFileSync(path.join(userDir, file), 'utf-8'));
      if (cronData.enabled && cronData.schedule && cronData.message) {
        try {
          activateCronJob(client, userId, cronData.name, {
            schedule: cronData.schedule,
            message: cronData.message,
            userData,
          });
          console.log(`[OpenDailywork] restored cron: ${userId}/${cronData.name}`);
        } catch (err) {
          console.error(`[OpenDailywork] restore ล้มเหลว: ${userId}/${cronData.name}`, err);
        }
      }
    }
  }
}

export default {
  data,
  execute,
  loadCronJob,
  listCronJobs,
  deleteCronJob,
  activateCronJob,
  deactivateCronJob,
  restoreAllCronJobs,
};