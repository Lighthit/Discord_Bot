# Paimon Bot

A bot that can be invited to a server/workspace via URL. Below are the access roles, activation instructions, and the current/planned feature set.

## Invite

Invite the bot using the provided **invite URL**. There are two invite methods:

| Method | Invite URL | Description |
|--------|-----------|--------------|
| **User** | `https://discord.com/oauth2/authorize?client_id=1522903417742430248&integration_type=1&scope=applications.commands` | Invite the bot to your personal account (e.g. for direct messages/private use). |
| **Server** | `https://discord.com/oauth2/authorize?client_id=1522903417742430248&permissions=8&integration_type=0&scope=bot+applications.commands` | Invite the bot to a server/workspace, making it available to all members of that server. |

Once invited (via either method), the bot is added and ready to be activated.

## Roles

| Role | Description |
|------|--------------|
| **Administrator** | Full access to the bot. Can activate/deactivate the bot, configure settings, and manage all features. Only users with the Administrator role can run the activation command. |

## How to Activate

To activate the bot, an **Administrator** must run the following command in the desired channel/chat:

```
/paimon
```

Once activated, the bot will start responding to interactions and begin providing the features listed below.

## Current Features

- **Sign Up** — `/paimon`
  - Allows users to register/sign up through the bot.
  - Available immediately after activation via `/paimon`.

- **Get Info** — `/get_info`
  - Lets a registered user retrieve their own stored info from the bot.
  - Requires the user to have signed up first; unregistered users will be prompted to run `/paimon`.

- **Edit User** — `/edit_user`
  - Sets a user's `AI_Model` and `AI_api_Keys` values in one command.
  - Restricted to a whitelisted set of admin user IDs/roles — regular members cannot run this command.

- **Chatbot** — `/chatbot`
  - Lets users ask the AI model a question directly through the bot.
  - **Free tier**: shared pool of 50 requests/day across **all users combined** (not per-user).
  - **Paid tier**: higher/unlimited usage available — requires contacting the bot owner/admin to arrange access.

- **Get DM** — `/get_dm`
  - Instantly creates/opens a DM channel with the bot, regardless of which server channel the command is run from.

## Future Feature

- **Session-based Chat History**
  - Conversation history will be stored as a session and automatically cleared every 1 day.

- **Clear Session** — `/clear_session`
  - Instantly clears the current session's chat history on demand.

- **Log Notes**
  - Ability to save and view log notes.

- **Cron Schedule**
  - Ability to create and view scheduled cron jobs.

- **Notifications**
  - Automated notifications/alerts sent to users or channels for relevant events or updates.

## Notes

- Only **Administrator** accounts can run the activation command.
- `/edit_user` is further restricted to a specific whitelist of user IDs/roles, separate from the general Administrator role.
- Future features (selection buttons, notifications) are planned and not yet available in the current build.