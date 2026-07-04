import "dotenv/config";
import { REST, Routes } from "discord.js";
import { Init_command } from "./command/callBot.js";

console.log("CLIENT_ID =", process.env.DISCORD_APPLICATION_ID);

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
    Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
    {
        body: [
            Init_command.data.toJSON()
        ],
    }
);
console.log("COMMAND DATA:");
console.log(Init_command.data.toJSON());
console.log("Commands refreshed!");