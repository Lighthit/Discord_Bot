# Paimon Bot

A bot that can be invited to a server/workspace via URL. Below are the access roles, activation instructions, and the current/planned feature set.

## Invite

Invite the bot using the provided **invite URL**. There are two invite methods:

| Method | Invite URL | Description |
|--------|-----------|--------------|
| **User** | `https://discord.com/oauth2/authorize?client_id=1522903417742430248&permissions=8&integration_type=1&scope=bot+applications.commands` | Invite the bot to your personal account (e.g. for direct messages/private use). |
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

## Current Feature

- **Sign Up**
  - Allows users to register/sign up through the bot.
  - Available immediately after activation via `/paimon`.

## Future Feature

- **Selection Buttons**
  - Interactive buttons that let users activate specific features/options directly from a message, instead of typing commands.
- **Notifications**
  - Automated notifications/alerts sent to users or channels for relevant events or updates.

## Notes

- Only **Administrator** accounts can run the activation command.
- Future features (selection buttons, notifications) are planned and not yet available in the current build.