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

- **Session-based Chat History**
  - Conversation history is stored per session to give the AI context across messages.
  - **Message limit**: keeps only the **last 20 messages** in a session; older messages are dropped once the limit is exceeded.
  - **Time limit**: the session automatically **expires and clears after 6 hours** of the session starting/last activity.

- **Log Notes / Reminders** — natural language via `/chatbot`
  - Users can type in plain language through the existing `/chatbot` command to save a note or set a reminder (e.g. "จดไว้ว่า...", "เตือนฉันพรุ่งนี้...").
  - The bot's LLM layer parses intent within the `/chatbot` conversation and stores the note/reminder automatically — no separate/dedicated command is needed.
  - Saved notes can be retrieved later by asking the bot naturally through `/chatbot` (e.g. "มีโน้ตอะไรบ้าง").
  - **Privacy**: notes are stored per-user and scoped to the requesting user's ID — one user cannot read, search, or list another user's memory vault notes through the bot.

- **Web Search** — natural language via `/chatbot`
  - Users can ask the bot about current events, recent facts, or anything requiring up-to-date information, and it will search the web automatically as part of the `/chatbot` conversation.
  - Powered by a free, self-hosted MCP server using **DuckDuckGo** search results — no third-party API key required, and no search API vendor receives your API credentials.
  - Only used when the query needs real-time/external info; the bot won't search the web for things already covered by stored notes, dates, or certificate data.

- **Auto Daily Work (Scheduled AI DM)** — `/opendailywork`, `/setdailywork`, `/listdailywork`, `/pausedailywork`, `/deletedailywork`
  - Lets a registered user set up a recurring, scheduled task where the bot asks the AI a fixed prompt on a cron schedule and DMs the AI's answer back automatically — no need to ask manually each time.
  - **`/opendailywork name:<name>`** — creates a new job slot under that name (not active yet; schedule/prompt still unset).
  - **`/setdailywork name:<name> schedule:<cron expression> prompt:<text>`** — sets the cron schedule and the AI prompt for that job, and turns it on. Can be re-run on the same name to update schedule/prompt later.
  - **`/listdailywork`** — shows all of the user's jobs, with name, on/off status, schedule, and ID.
  - **`/pausedailywork name:<name>`** — temporarily stops a job without deleting its schedule/prompt; can be resumed later via `/setdailywork`.
  - **`/deletedailywork name:<name>`** — permanently deletes a job and stops it if running.
  - Jobs are stored per-user as JSON files and are automatically restored (re-scheduled) whenever the bot process restarts, so they survive deploys/restarts as long as the underlying storage persists.
  - Delivery is DM-only for now (results are sent to the user's DMs, not a server channel).

## Future Feature

- **Clear Session** — `/clear_session`
  - Instantly clears the current session's chat history on demand.

- **Clear memory notes**
  - Maybe clear in every 2 month in pass maybe use in other agent to manages specificaly

## Notes

- Only **Administrator** accounts can run the activation command.
- `/edit_user` is further restricted to a specific whitelist of user IDs/roles, separate from the general Administrator role.
- Cron scheduling is now available via the Auto Daily Work feature above; broader event-triggered notifications are still planned and not yet available in the current build.