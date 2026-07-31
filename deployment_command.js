import "dotenv/config";
import { REST, Routes } from "discord.js";
import { Init_command } from "./command/signUp_slashCMD.js";
import { getInfo } from "./command/getInfo_slash.js";
import { Chatbot } from "./command/Chatbot.js";
import { GO_DM_MSG } from "./command/Go_DM_msg.js";
import * as  editUserCommand from "./command/edit_userInfo.js"
import * as Cron_work from "./command/Daily_noti.js"
import * as setDailyWork from './command/setdailywork.js';
import * as listDailyWork from './command/listdailywork.js';
import * as deleteDailyWork from './command/deletedailywork.js';
import * as pauseDailyWork from './command/pausedailywork.js';
console.log("CLIENT_ID =", process.env.DISCORD_APPLICATION_ID);

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);

await rest.put(
    Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID),
    {
        body: [
            Init_command.data.toJSON(),
            getInfo.data.toJSON(),
            editUserCommand.data.toJSON(),
            Chatbot.data.toJSON(),
            GO_DM_MSG.data.toJSON(),
            Cron_work.data.toJSON(),
            setDailyWork.data.toJSON(),
            listDailyWork.data.toJSON(),
            deleteDailyWork.data.toJSON(),
            pauseDailyWork.data.toJSON(),
        ],
    }
);
console.log("COMMAND DATA:");
console.log(Init_command.data.toJSON());
console.log("Commands refreshed!");