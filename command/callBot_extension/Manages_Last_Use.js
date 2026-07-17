import { readFileSync, writeFileSync } from 'fs';
import path ,{ join } from "path";


export function updateLastUsed(interaction) {
    const folderPath = path.join(process.cwd(), "users_id");
    const filePath = path.join(folderPath, `${interaction.user.id}.json`);
    // อ่านไฟล์เดิมมาก่อน
    const raw = readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    // แก้แค่ 2 ค่านี้ ค่าอื่น (id, joinedAt) คงเดิม
    data.Last_Discord_Call = interaction.guild?.id || "Direct_msg";
    data.Last_Chanel_Call = interaction.channel?.id || "Direct_msg";
    // เขียนกลับไฟล์เดิม
    writeFileSync(filePath, JSON.stringify(data, null, 2));
}

