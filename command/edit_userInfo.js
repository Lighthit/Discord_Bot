// ============================================================
// /edit_user [id] [model] [key]
// แก้ไฟล์ ./users_id/[id].json — เซ็ต AI_Model และ AI_api_Keys พร้อมกัน
// จำกัดสิทธิ์เฉพาะ role/user ที่กำหนด
// ใช้กับ discord.js v14
// ============================================================

import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder , MessageFlags} from 'discord.js';
import { writeFile, rename, readFile, access } from 'fs/promises';
import { join, resolve, sep } from 'path';
import path from "path";

// -------------------------------------------------------------
// 1) ใครมีสิทธิ์แก้ไฟล์บ้าง
// -------------------------------------------------------------

const ALLOWED_USER_IDS = [
  '385795225097863168', // Santy Account
];

const USERS_DIR = path.join(process.cwd(), "users_id");

function hasEditPermission(interaction) {
  return ALLOWED_USER_IDS.includes(interaction.user.id);
}

// -------------------------------------------------------------
// 2) สร้าง path ของไฟล์อย่างปลอดภัย - กัน path traversal
// -------------------------------------------------------------
function getSafeUserFilePath(rawId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(rawId)) {
    throw new Error('id ไม่ถูกต้อง (อนุญาตเฉพาะตัวอักษร ตัวเลข - และ _)');
  }
  const filePath = join(USERS_DIR, `${rawId}.json`);
  const resolved = resolve(filePath);
  if (!resolved.startsWith(resolve(USERS_DIR) + sep)) {
    throw new Error('path ไม่ถูกต้อง');
  }
  return resolved;
}

// -------------------------------------------------------------
// 3) กันเขียนไฟล์ชนกัน (atomic write + in-memory lock ต่อไฟล์)
// -------------------------------------------------------------
const writeLocks = new Map();
async function safeWriteJson(filePath, data) {
  while (writeLocks.get(filePath)) {
    await new Promise((r) => setTimeout(r, 50));
  }
  writeLocks.set(filePath, true);
  try {
    const tmpPath = `${filePath}.tmp`;
    await writeFile(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    await rename(tmpPath, filePath);
  } finally {
    writeLocks.delete(filePath);
  }
}

async function readJson(filePath) {
  const raw = await readFile(filePath, 'utf-8');
  return JSON.parse(raw);
}

// -------------------------------------------------------------
// 4) นิยาม slash command — 3 option ตายตัว: id, model, key
//    ถ้าอยากให้ "model" เป็น dropdown เลือกจากรายชื่อที่กำหนดไว้
//    (กันพิมพ์ผิด/พิมพ์ model ที่ไม่รองรับ) ให้ uncomment .addChoices()
//    ด้านล่าง แล้วแก้ list ตามรุ่นที่ใช้งานจริง
// -------------------------------------------------------------
const data = new SlashCommandBuilder()
  .setName('edit_user')
  .setDescription('ตั้งค่า AI Model และ API Key ให้ user (users_id/[id].json)')
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
  .addStringOption((opt) =>
    opt.setName('id').setDescription('User ID / ชื่อไฟล์ (ไม่ต้องใส่ .json)').setRequired(true)
  )
  .addStringOption((opt) =>
    opt
      .setName('model')
      .setDescription('ชื่อ AI Model')
      .setRequired(true)
    // .addChoices(
    //   { name: 'GPT-4o', value: 'gpt-4o' },
    //   { name: 'Claude Sonnet', value: 'claude-sonnet' },
    // )
  )
  .addStringOption((opt) =>
    opt.setName('key').setDescription('API Key').setRequired(true)
  );

async function execute(interaction) {
  // ---- เช็คสิทธิ์ ----
  if (!hasEditPermission(interaction)) {
    return interaction.reply({
      content: '❌ คุณไม่มีสิทธิ์ใช้คำสั่งนี้',
      flags: MessageFlags.Ephemeral,
    });
  }

  const rawId = interaction.options.getString('id');
  const model = interaction.options.getString('model');
  const apiKey = interaction.options.getString('key');

  await interaction.deferReply({ lags: MessageFlags.Ephemeral });

  let filePath;
  try {
    filePath = getSafeUserFilePath(rawId);
  } catch (err) {
    return interaction.editReply({ content: `❌ ${err.message}` });
  }

  // เช็คว่าไฟล์มีอยู่จริงก่อน (กันสร้างไฟล์มั่วจาก id พิมพ์ผิด)
  try {
    await access(filePath);
  } catch {
    return interaction.editReply({
      content: `❌ ไม่พบไฟล์สำหรับ id: \`${rawId}\``,
    });
  }

  try {
    const jsonData = await readJson(filePath);

    const oldModel = jsonData.AI_Model;
    const oldKey = jsonData.AI_api_Keys;

    jsonData.AI_Model = model;
    jsonData.AI_api_Keys = apiKey;

    await safeWriteJson(filePath, jsonData);

    // ปกปิด API key บางส่วนตอนโชว์ผล กันหลุดในหน้าจอ/log ที่คนอื่นเห็นได้
    const maskKey = (k) => (k && k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : '(ไม่มี)');

    const embed = new EmbedBuilder()
      .setTitle('✅ อัปเดตข้อมูล user สำเร็จ')
      .addFields(
        { name: 'User ID', value: rawId, inline: true },
        { name: 'Model (เดิม → ใหม่)', value: `${oldModel ?? '(ไม่มี)'} → ${model}` },
        { name: 'API Key (เดิม → ใหม่)', value: `${maskKey(oldKey)} → ${maskKey(apiKey)}` },
        { name: 'แก้โดย', value: `<@${interaction.user.id}>` }
      )
      .setColor(0x57f287)
      .setTimestamp();

    return interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Error editing user JSON:', err);
    return interaction.editReply({
      content: `❌ เกิดข้อผิดพลาด: ${err.message}`,
    });
  }
}

export { data, execute };

// ============================================================
// วิธีต่อกับ index.js:
//
// import * as editUserCommand from './command/edit_userInfo.js';
//
// client.on(Events.InteractionCreate, async (interaction) => {
//   if (!interaction.isChatInputCommand()) return;
//   if (interaction.commandName === editUserCommand.data.name) {
//     await editUserCommand.execute(interaction);
//     return;
//   }
// });
// ============================================================