# ZiuuX

Moderation, AI moderation, advanced logging and an interactive staff panel for Discord.
Node.js 20+ • TypeScript • discord.js v14 • MongoDB (Mongoose) • Gemini & OpenAI • Railway.

> **Status honesty:** this project was written without network access, so `npm install`, a TypeScript build against the real
> discord.js/mongoose types, and live Discord/MongoDB/Gemini/OpenAI calls could **not** be run by its author. What *was* executed
> (pure-logic tests) and what you must verify yourself is listed in [Verification](#verification). Please run the steps there before relying on it.

## Features
- **Moderation:** `/warn /warnings /removewarn /clearwarnings /kick /ban /unban /timeout /untimeout /purge /lock /unlock /slowmode`
  with Discord-permission checks, bot-permission checks, strict role-hierarchy checks, DM notices, per-guild numbered cases.
- **AI moderation `/aimod`:** interactive dashboard (enable, sensitivity, categories, thresholds, actions, blocked words,
  alert/log/scope channels, exemptions, provider health, incidents). Real Gemini/OpenAI adapters, structured-output validation,
  bounded queue, per-guild rate limit, timeouts, circuit breaker, **fixed fail-open**. Message **text only** in v1.
- **Command configuration `/cmdconfig`:** enable/disable commands, restrict by role and channel; enforced for slash commands *and* staff-panel actions.
- **Logging `/setlogs` `/listlogs`:** 10 separately routable categories (message edit/delete, join, leave, ban, unban, timeout, role changes, channel changes, moderation actions).
- **Staff panel `/staffpanel`:** member tools, channel tools, recent cases, panel settings. Stateless; permissions are re-checked on every click.
- **Owner-only `/botsettings`:** global AI provider + model, key status (never the key), health, connection test, change history.
- **Info:** `/userinfo /serverinfo /avatar /roleinfo /systemstatus`.
- Multi-guild: every guild-owned document carries `guildId`; repositories take `guildId` as their first argument.

## Security model (read this)
- **Two separate permission systems.**
  `permissions/PermissionService.ts` + `hierarchy.ts` authorise moderation and have **no concept of the bot owner**.
  `permissions/OwnerGate.ts` (the only file that reads `BOT_OWNER_ID`) lets the owner bypass ZiuuX **config-panel access checks only**
  (`/aimod /cmdconfig /setlogs /listlogs /staffpanel` panels; audited in `OwnerAudit`) and gates `/botsettings`.
  The owner is **never** exempt from Discord permissions, role hierarchy, bot-permission checks or `/cmdconfig` restrictions.
  A test scans the source to enforce that nothing else touches the owner setting.
- Config commands are visible to everyone in the command picker and enforced at runtime (so the owner bypass can work); `/botsettings` is registered admin-only + DM-capable and enforced at runtime.
- API keys exist only in environment variables, are redacted from logs and errors, and are sent in headers (never URLs).
- `/cmdconfig` and `/botsettings` can never be disabled or restricted (no lockout).
- Message text goes to Google/OpenAI when AI moderation is enabled. Tell your members. Excerpts stored for incidents are truncated to 200 chars and auto-expire after 90 days.
- Prompt-injection posture: messages are passed as JSON *data*; the model can only return a schema-validated score object, never actions.

## AI moderation behaviour
| Category | Default threshold | Default action | Notes |
|---|---|---|---|
| harassment, hate, threats | 0.80 | delete | |
| sexual, violence, spam_scam | 0.85 | delete | |
| profanity | 0.90 | log | disabled by default |
| self_harm | 0.70 | **alert only** | never deleted/warned/timed out; cannot be configured otherwise |

Actions: **log**, **delete**, **warn**, **timeout** (no kick/ban). Sensitivity low/medium/high shifts thresholds by +0.10/0/−0.10.
**Confidence safeguards (fixed):** warn/timeout require confidence ≥ 0.70 **and** score ≥ 0.75, otherwise they are downgraded to *log only*;
delete requires confidence ≥ 0.50. Admins and the server owner are always exempt. Blocked words are matched locally (plain string matching, no regex) and work even when the AI is down.
**Fail-open (not configurable):** timeout, HTTP error, rate limit, invalid/schema-violating output, open breaker, full queue, per-guild rate limit → no action, internal log, health counter.

## Setup

### 1. Discord Developer Portal
1. Create an application + bot; copy the **token** (`DISCORD_TOKEN`) and **Application ID** (`CLIENT_ID`).
2. Bot → **Privileged Gateway Intents**: enable **Server Members Intent** and **Message Content Intent** (required; verified bots in 100+ servers need Discord approval).
3. Invite (adjust `CLIENT_ID`):
   `https://discord.com/oauth2/authorize?client_id=CLIENT_ID&scope=bot%20applications.commands&permissions=1374658325654`
   (Kick, Ban, Manage Channels, View Audit Log, View Channel, Send Messages, Send in Threads, Manage Messages, Embed Links, Read History, Use External Emojis, Manage Roles, Timeout Members).
4. **Put the ZiuuX role above every role it should moderate.** Hierarchy is enforced.
5. The bot must be in the server that owns your 40 custom emojis (`npm run verify-emojis` tells you what resolves). Missing emojis are simply omitted.

### 2. MongoDB Atlas
1. Create a cluster. A **replica set is required** (case numbers and warnings use transactions); Atlas clusters are replica sets.
2. *Database Access*: create a user with the `readWrite` role on your database only.
3. *Network Access*: Railway does not give you a fixed egress IP by default, so you will most likely need `0.0.0.0/0`. If you do that, use a long random password and a least-privilege user.
4. Copy the connection string into `MONGODB_URI` and **include the database name in the path** (`...mongodb.net/ziuux?retryWrites=true&w=majority`); without it the driver uses a database called `test`.
5. Indexes (unique/TTL) are created automatically at startup. Back up before the first production use as you would for any database.

### 3. Environment variables
Validated at startup with zod; the bot refuses to start and prints every problem if a required one is missing or malformed.

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_TOKEN` | yes | Bot token |
| `CLIENT_ID` | yes | Application ID (command registration) |
| `MONGODB_URI` | yes | Atlas connection string, **including the database name** |
| `BOT_OWNER_ID` | yes | The only user who can open `/botsettings` and bypass *config-panel* access (never moderation) |
| `GEMINI_API_KEY` | one AI key recommended | Google Gemini. Empty = provider unavailable (bot still boots) |
| `OPENAI_API_KEY` | one AI key recommended | OpenAI. Empty = provider unavailable |
| `GUILD_ID` | no | Dev only: register commands to one guild instantly |
| `NODE_ENV`, `LOG_LEVEL`, `PORT` | no | `PORT` is set by Railway and serves `/health` |
| `AI_DEFAULT_PROVIDER`, `AI_DEFAULT_MODEL` | no | Seed for the very first boot only; afterwards use `/botsettings` |

API keys live only in environment variables; they are never stored in MongoDB, logged, or shown (the dashboard only says "configured / not configured").

### Custom emoji setup
All 40 emojis are defined once in `src/config/emojis.ts` with their exact IDs. The bot can only show an emoji if it is a **member of the server that owns it**
(add the bot there; it does not need extra permissions in that server). Emojis it cannot see are silently omitted (no crash, no Unicode substitute).
Check with `npm run verify-emojis` (needs `DISCORD_TOKEN`). In servers where the bot posts, **Use External Emojis** is in the invite permissions.

### 4. Run locally
```bash
npm run verify:install   # one command: install -> lockfile -> `npm ci` -> build -> tests (needs network)
# or step by step:
npm install              # FIRST TIME ONLY: creates package-lock.json (none is shipped). Commit it.
                         # After that, `npm ci` gives reproducible installs (and Railway's Node builder normally uses it when a lockfile is present).
cp .env.example .env     # fill it in
npm run build
npm run ai-smoke-test    # real calls to your configured providers
npm run dev              # or: npm start
```
Commands register on boot only when their definitions changed (hash stored in `BotSettings`); `npm run deploy-commands` forces it.
Global commands can take up to ~1h to appear; set `GUILD_ID` while developing. If you switch between guild and global scope, delete the old scope's commands.

### 5. Deploy to Railway
1. Push the repo to GitHub → Railway → *New project → Deploy from repo*.
2. Add all variables under *Variables* (keys only here, never in the repo).
3. Do not rely on the build to install dev tools: `typescript` and `@types/node` are regular dependencies on purpose, so the build still works when `NODE_ENV=production` is set as a Railway variable. Commit `package-lock.json` (see Run locally) so installs are reproducible.
4. `railway.json` sets start command `npm start`, health check `/health`, restart on failure, **1 replica**. The build must run `npm run build` (compiles to `dist/`, which `npm start` runs); Railway normally detects the `build` script, but if your first deploy fails with a missing `dist/src/index.js`, set the service's *Build Command* to `npm run build`.
5. **Run exactly one replica** and avoid overlapping deploys if possible (two live instances would double-process events). Railway can briefly run the old and new deployment side by side during a deploy; check Railway's documentation for its deployment *overlap* setting and set it to 0 if available (not verified by the author). Sharding is *not* enabled (see below).
6. Logs are JSON (pino). On `SIGTERM` the bot stops accepting AI work, drains in-flight requests (bounded), flushes health stats and closes Mongo.

### 6. Before first real use
- Check the model allow-list in `src/config/aiModels.ts` against Google's/OpenAI's current model names (they change; the author could not verify them offline). Run `npm run ai-smoke-test`.
- Walk through `tests/manual-checklist.md` in a test server.

## Safe database testing
`npm test` skips the database tests unless `TEST_MONGODB_URI` is set. Those tests **delete every document in every ZiuuX collection** of the target database, so:
- Use a **separate** database (e.g. `ziuux_test` on the same Atlas cluster or a free one). Never point it at production.
- The suite refuses to run unless the database name contains `test` and differs from the database in `MONGODB_URI`.
- It needs a replica set (Atlas qualifies; a local standalone `mongod` does not support transactions).
```bash
TEST_MONGODB_URI="mongodb+srv://USER:PASS@CLUSTER.mongodb.net/ziuux_test?retryWrites=true&w=majority" npm test
```

## Troubleshooting
| Symptom | Likely cause / fix |
|---|---|
| `npm ci` fails with "package-lock.json ... missing" | No lockfile shipped: run `npm install` once and commit the result |
| Build: `Cannot find module 'discord.js'` etc. | Dependencies not installed; run `npm install` |
| Startup: `Invalid environment configuration` | The listed variable is missing/malformed; see the table above |
| `MongoDB connection failed` | Wrong URI, user/password, or Atlas Network Access blocks Railway |
| `Transaction numbers are only allowed on a replica set` | Using a standalone MongoDB; use Atlas |
| Slash commands do not appear | Global registration can take up to ~1h; set `GUILD_ID` for instant dev registration; confirm the bot was invited with the `applications.commands` scope |
| "Used disallowed intents" on login | Enable **Server Members** and **Message Content** intents in the Developer Portal |
| Moderation says "move my role higher" / "missing permission" | Put the ZiuuX role above the target's highest role and check its permissions |
| No emojis shown | Bot is not in the emoji server; run `npm run verify-emojis` |
| Logs not appearing | `/listlogs` shows per-category status (missing permissions / channel missing) |
| AI moderation does nothing | `/aimod` -> Provider health: key not configured or provider degraded (fail-open means no action); run `npm run ai-smoke-test`; also check exemptions and scan scope |
| Railway deploy: missing `dist/src/index.js` | Set the service Build Command to `npm run build` |
| Railway health check fails | `/health` returns 503 until both Discord and MongoDB are ready; check logs for login or Mongo errors |

## Project layout
```
src/
  index.ts                 boot: env → health server → Mongo → services → client → events
  config/                  env (zod), constants, emojis (40, typed), ai categories/models, log categories, command keys
  core/                    errors, respond helpers, access helpers, command + interaction pipelines, registries
  permissions/             PermissionService (moderation), hierarchy (pure), OwnerGate (config-panel bypass only)
  services/                Moderation, Case, Warning, Lock, Logging, CommandConfig, AI*, BotSettings, Health, Retention, ...
  ai/                      provider interface/registry, Gemini+OpenAI adapters, schema, breaker, queue, limiter, decision engine
  database/                models (13), guild-scoped repositories, transaction helper, connect
  commands/ events/ interactions/   explicit barrel registries (a missing import is a compile error)
  ui/                      embeds, component builders, panels (staffpanel, aimod, cmdconfig, botsettings)
scripts/                   deploy-commands, verify-emojis, ai-smoke-test, run-tests
tests/                     unit (node:test), integration (needs TEST_MONGODB_URI), manual-checklist.md
```
Custom IDs are `zx:<module>:<action>:<args…>` (`sp` staffpanel, `am` aimod, `cc` cmdconfig, `bs` botsettings), ≤100 chars, validated with zod, carrying identifiers only. Panels use no collectors, so they survive restarts; stale IDs get a friendly "panel expired".

### Adding an AI provider
Create `src/ai/providers/XProvider.ts` implementing `AIProvider`, add its id/models to `config/aiModels.ts`, and `.register()` it in `bootstrap/services.ts`.

### Sharding later
Caches sit behind `utils/cache.ts` (swap for a shared/broadcast cache), nothing important lives only in memory, and Mongo is the source of truth. Remaining work to enable it: a `ShardingManager` entry point, a cross-shard cache invalidation, and moving the in-memory AI queue/limiter/breaker (per-process today) behind shared state.

## Design notes / deviations from the original plan
- ESLint was replaced by `tsc --noEmit` (`npm run lint`) and source-scanning tests; no lint dependency to install.
- Tests use Node's built-in `node:test` (no Vitest / mongodb-memory-server); DB integration tests run against a real MongoDB you provide.
- Commands/events/interactions use explicit barrel files instead of filesystem scanning.
- No `StaffPanelState`, `TempAction`/scheduler (no temp bans in v1), or appeals. Timeouts expire natively in Discord.
- `/aimod` "moderation and logging channels" are implemented as an **alert** channel (self-harm alerts), a **log** channel (all incidents) and an optional **scan scope**.
- Slowmode is available on regular text channels only; lock/unlock on text and announcement channels. Locking denies `@everyone` and restores the previous overwrite on unlock (roles with explicit allow overwrites can still speak).
- AI exemptions always include the server owner and members with Administrator.
- Purge removes up to 100 messages from the 100 most recent that are < 14 days old (Discord limit).
- `/roleinfo` member count uses the member cache.

## Verification
**Executed by the author** (Node 22, no network, from the packaged ZIP): `npm test` compiles `tests/` with `tsc` and runs `node:test`.
Result: 87 tests, **78 passed, 0 failed, 9 skipped**. The 78 cover: hierarchy matrix, owner-isolation source scan, `/cmdconfig` rule enforcement,
AI decision/safeguards, AI failure paths (timeout, 429, 5xx, network, malformed/invalid output, breaker open/half-open/recovery, queue bounds, rate limiter)
against a fake `fetch`, provider request shapes, blocked-word matcher, custom IDs, env parsing, emoji exactness (40/40), duration parsing.
The `/health` endpoint (503 until Discord and MongoDB are both ready, then 200; unknown paths 404) is covered by a real HTTP test.
TypeScript parsed every file with no syntax errors and no unresolved *local* imports; type-checking against the real discord.js/mongoose types was **not** possible.

**What still needs something real** (nothing below has been run):

| What | Needs | Command |
|---|---|---|
| Real compile against discord.js / mongoose / pino types | `npm install` only | `npm run build` |
| 3 skipped registry tests (command keys/names/JSON, permission classes, pager IDs) | `npm install` only (no token) | `npm test` |
| 6 skipped DB integration tests (case numbering under concurrency, guild isolation, transactions, rollback, unique indexes, retention purge) | MongoDB **replica set** in `TEST_MONGODB_URI` pointing at a separate disposable database (see Safe database testing) | `TEST_MONGODB_URI=... npm test` |
| Emoji access | Discord bot token + bot in the emoji server | `npm run verify-emojis` |
| Gemini/OpenAI adapters and model names | real API keys | `npm run ai-smoke-test` |
| Slash commands, buttons, selects, modals, events, hierarchy against real roles, logging, staff panel, AI end to end, fail-open drill, restart persistence | live bot in a test server (+ Mongo + keys) | `tests/manual-checklist.md` |
