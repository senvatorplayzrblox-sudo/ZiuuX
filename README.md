# ZiuuX

A TypeScript Discord administration bot using discord.js v14 and MongoDB Atlas.

## Requirements
- Node.js 20.11+
- A Discord application/bot
- MongoDB Atlas M0 free cluster (persistent database)
- A host that supports Node.js processes

## Important access rule
Only members with Discord's **Administrator** permission can open and use configuration dashboards, except Discord user ID `1418875905085935637`, which is explicitly allowlisted for bot configuration even without Administrator. This exception only grants access to ZiuuX configuration panels; it does not grant Discord permissions or bypass role hierarchy for moderation actions.

## Local setup
1. Create a Discord application at https://discord.com/developers/applications.
2. Add a Bot, copy its token, and enable the required privileged intents (Server Members Intent and Message Content Intent) if you use those features.
3. Invite it with `bot` and `applications.commands` scopes. Grant only the permissions it needs (Manage Messages, Moderate Members, Manage Channels, View Audit Log, etc.).
4. Create a free MongoDB Atlas M0 cluster. Create a database user, add your host IP (for a cloud host, Atlas network access may require `0.0.0.0/0`; use a strong database password), and copy the Node.js connection string.
5. Copy `.env.example` to `.env` and fill in the three required values.
6. Run `npm install`, `npm run deploy-commands`, then `npm run dev`.
7. For production, run `npm run build` then `npm start`.

## Persistence
Guild configuration, warning records, and moderation history are stored in MongoDB, not on the host's filesystem. Redeploying/restarting the bot does not erase MongoDB data. Keep the Atlas cluster and database user; do not delete the cluster. Free-tier limits and availability are controlled by MongoDB Atlas.

## Commands
- `/aimod` — AI moderation configuration/status dashboard (rule-based keyword checks are implemented; AI provider is not enabled by default).
- `/cmdconfig` — command availability/configuration dashboard.
- `/setlogs` — choose a log event and channel.
- `/listlogs` — inspect, enable, disable, update, or delete log routes.
- `/warn`, `/warnings`, `/removewarn`, `/clearwarnings`
- `/purge`, `/lock`, `/unlock`, `/slowmode`
- `/userinfo`, `/serverinfo`, `/systemstatus`

## Limitations
- No AI provider is configured by default. Do not paste private member data into third-party AI services without understanding their data policies and obtaining appropriate consent.
- Discord may not provide the actor for every deleted message; message content is only available if Discord delivered/cached it.
- ZiuuX cannot configure or execute another bot's private slash commands. Third-party bot integrations require that provider's documented API.
- A free host may sleep or have usage limits. MongoDB preserves data, but a database does not guarantee 24/7 bot uptime.
