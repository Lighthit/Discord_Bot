import "dotenv/config";
import fs from "fs";
import path from "path";

import {
    Client,
    Events,
    GatewayIntentBits,
} from "discord.js";

import { Init_command } from "./command/callBot.js";
import { handleSignUpButton } from "./command/callBot_extension/signup.js";
import { updateLastUsed } from "./command/callBot_extension/Manages_Last_Use.js";

const folderPath = path.join(process.cwd(), "users_id");
if (!fs.existsSync(folderPath)) {
    fs.mkdirSync(folderPath, { recursive: true });
    console.log("Folder created");
} else {
    console.log("Folder already exists");
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds],
});

client.once(Events.ClientReady, (client) => {
    console.log(`${client.user.tag} is online.`);
});

client.on(Events.InteractionCreate, async (interaction) => {
    //Make last use and server Chanel RECORD!
    // ✅ Slash Command
    if (interaction.isChatInputCommand()) {
        if (interaction.commandName === Init_command.data.name) {
            await Init_command.execute(interaction);
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