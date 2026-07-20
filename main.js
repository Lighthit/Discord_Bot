import "dotenv/config";
import fs from "fs";
import fsp from "fs/promises";    // ใช้ readFile, writeFile
import path from "path";

import {
    Client,
    Events,
    GatewayIntentBits,
    MessageFlags,
    User,
} from "discord.js";

import { Init_command } from "./command/signUp_slashCMD.js";
import { getInfo } from "./command/getInfo_slash.js";
import { handleSignUpButton } from "./command/callBot_extension/signup.js";
import { updateLastUsed } from "./command/callBot_extension/Manages_Last_Use.js";
import { Chatbot } from "./command/Chatbot.js";
import { GO_DM_MSG } from "./command/Go_DM_msg.js";
import * as editUserCommand from './command/edit_userInfo.js';

const folderPath_userId = path.join(process.cwd(), "users_id");
const folderPath_JobId_dir = path.join(process.cwd(),"jobs")
if (!fs.existsSync(folderPath_userId)) {
    fs.mkdirSync(folderPath_userId, { recursive: true });
    console.log("Folder UserId created");
} else {
    console.log("Folder UserId already exists");
}
if (!fs.existsSync(folderPath_JobId_dir)) {
    fs.mkdirSync(folderPath_JobId_dir, { recursive: true });
    console.log("Folder created");
} else {
    console.log("Folder Jobs  already exists");
}
const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (client) => {
    console.log(`${client.user.tag} is online.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    updateLastUsed(interaction);
    //Make last use and server Chanel RECORD!
    // ✅ Slash Command
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === Init_command.data.name) {
            await Init_command.execute(interaction);
            return;
        }

        // ✅ เพิ่มตรงนี้ — ก่อนเช็ค userFile เพราะ edit_user ไม่ต้อง verify แบบ user ทั่วไป
        if (interaction.commandName === editUserCommand.data.name) {
            await editUserCommand.execute(interaction);
            return;
        }

        // เช็กว่าลงทะเบียนหรือยัง
        const userFile = path.join(
            process.cwd(),
            "users_id",
            `${interaction.user.id}.json`
        );
        let userData;
        try {
            let raw = await fsp.readFile(userFile, "utf8");
            userData = JSON.parse(raw);   // ✅ แปลงเป็น object ก่อน
        } catch (err) {
            console.log(err)
            await interaction.reply({
                content: "❌ คุณยังไม่ได้ลงทะเบียน กรุณาใช้ `/paimon` ก่อน",
                flags: MessageFlags.Ephemeral,
            });
            return;
        }
        // ====== เรียก Command ที่ต้องการ verify user ก่อน ======
        switch (interaction.commandName) {
            case getInfo.data.name:
                await getInfo.execute(interaction, userData);
                break;

            case Chatbot.data.name:
                await Chatbot.execute(interaction, userData);
                break;

            case GO_DM_MSG.data.name:
                await GO_DM_MSG.execute(interaction, userData);
                break;

            default:
                console.warn(`ไม่พบคำสั่ง: ${interaction.commandName}`);
                break;
        }
        return;
    }
    // ✅ Button
    if (interaction.isButton()) {
        const [action, userId] = interaction.customId.split("&");

        if (action === "SignUp_NewUser") {
            // กันคนอื่นกดปุ่มแทนเจ้าของ
            if (interaction.user.id !== userId) {
                return interaction.reply({
                    content: "❌ ปุ่มนี้ไม่ใช่ของคุณนะ",
                    flags: 64, // MessageFlags.Ephemeral
                });
            }

            await handleSignUpButton(interaction);
        }
        return;
    }
});

client.login(process.env.DISCORD_TOKEN);