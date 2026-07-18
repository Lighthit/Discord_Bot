import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from "discord.js";
import axios from 'axios';

export const getInfo = {
    data: new SlashCommandBuilder()
        .setName("get_info")
        .setDescription("For getting the Personal Data such as User id, Last Channel/Server(Guild) Used"),

    async execute(interaction, User_info) {
        
        // getting the peronal info AI token
        let response_tokenResult;
        try {
            response_tokenResult = await axios.get('https://openrouter.ai/api/v1/key', {
            headers: {
                'Authorization': `Bearer ${User_info.AI_api_Keys}`
            }
            });
        } catch (error) {
            console.error('Error:', error.response?.status, error.message);
        }

       const AI_Expired = {
            Token_Expired_At: response_tokenResult.data.data.expires_at
                ? new Date(response_tokenResult.data.data.expires_at).toLocaleString("en-US", {
                    timeZone: "Asia/Bangkok",
                    year: "numeric",
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false
                })
                : 'N/A'
        };

        const entries = Object.entries({ ...User_info, ...AI_Expired });
        // const entries = Object.entries(User_info);

        const embed = new EmbedBuilder()
            .setTitle("📋 User Info")
            .setColor(0x5865F2)
            .setTimestamp()
            .setFooter({
                text: `Requested by ${interaction.user.tag}`,
                iconURL: interaction.user.displayAvatarURL()
            });

        const fields = entries.map(([key, value]) => ({
            name: formatKey(key),
            value: `\`${value}\``, // ห่อเฉพาะ value ด้วย inline code -> แตะค้าง/double-click copy ได้เฉพาะแถว
            inline: false
        }));

        embed.addFields(fields);

        await interaction.reply({
            embeds: [embed],
            flags: MessageFlags.Ephemeral
        });
    }
}

function formatKey(key) {
    return key.replace(/_/g, " ");
}