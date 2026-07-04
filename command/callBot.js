import { SlashCommandBuilder , MessageFlags } from "discord.js";
import { Signup } from "./callBot_extension/signup.js";
import fs from "fs";
import path from "path";
import { sign } from "crypto";
import { updateLastUsed } from "./callBot_extension/Manages_Last_Use.js";
export const Init_command = {
    data: new SlashCommandBuilder()
        .setName("paimon")
        .setDescription("Replies with Paimon The Emergency Food!"),

    async execute(interaction) {
        const folderPath = path.join(process.cwd(), "users_id");
        const files = fs.readdirSync(folderPath);

        // 👇 ตรงนี้คือจุดอ่านคนกดคำสั่ง
        const user = interaction.user;
        //console.log(user.id);           //ไม่มีวันเปลี่ยนแม้เปลี่ยนชื่อ
        //console.log(user.username);
        console.log("Guild ID:", interaction.guild?.id || "Direct_msg");  //server discord ที่ถูกเรียก
        console.log("Channel ID:", interaction.channel?.id || "Direct_msg"); //chenel ที่ถูกเรียก
        
        if (files.includes(`${user.id}.json`)){
            updateLastUsed(interaction);
            await interaction.reply({content:`Hello ${user.username} 👋`,flags: MessageFlags.Ephemeral});
        }else{
            //await interaction.user.send("Hello 👋 This is DM from bot");
            await Signup(interaction);
        }
        //await interaction.channel.send(`Welcome ${user.username} to the server! 🎉`);
        
    },
};