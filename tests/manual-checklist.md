# ZiuuX manual verification checklist

Automated tests cannot talk to live Discord, Gemini or OpenAI. Run this once in a **test server** after deploying.
Use three accounts: **Owner** (server owner), **Mod** (has Timeout/Kick/Ban + a role below the bot), **Member** (no permissions).
Put the ZiuuX bot role **above** Mod and Member roles.

## 0. Boot
- [ ] Railway logs show: MongoDB connected, "slash commands registered", "ZiuuX is online"
- [ ] `/health` returns 200 `{"status":"ok"}`
- [ ] `npm run verify-emojis` reports 40/40 (or lists exactly which are missing)
- [ ] `npm run ai-smoke-test` shows OK for each provider you configured

## 1. Moderation (as Mod unless noted)
- [ ] `/warn` Member -> case #1, DM received, `/warnings` shows it, moderation log (if set) shows it
- [ ] `/removewarn case:1` -> removed; `/warnings` shows "Removed"; `/removewarn case:1` again -> error
- [ ] `/clearwarnings` with 0 warnings -> clear error; with warnings -> cleared
- [ ] `/timeout 5m`, `/untimeout`; invalid duration `10` -> error; `29d` -> error
- [ ] `/kick` Member; `/ban` Member with `delete_days`; `/ban` a user ID who is not in the server; `/unban`; `/ban` again on banned user -> "already banned"
- [ ] `/purge amount:5`, `/purge amount:5 user:Member`; purge in an empty channel -> clear error
- [ ] `/lock` then `/unlock` restores the **previous** @everyone overwrite (test a channel where @everyone had an explicit Send allow); `/lock` twice -> error
- [ ] `/slowmode 10`, `/slowmode 0`

## 2. Hierarchy & permissions (the important negatives)
- [ ] Mod cannot warn/timeout/kick/ban a member with an equal or higher role
- [ ] Nobody can target the server owner or themselves or the bot
- [ ] Move the bot role BELOW the target -> action refused with the "move my role higher" message
- [ ] Member (no perms) running `/ban` is refused
- [ ] **Owner-ID test:** with the `BOT_OWNER_ID` account holding NO moderation permission/role in the server, `/ban` is refused (owner bypass never applies to moderation)
- [ ] Same account CAN open `/aimod`, `/cmdconfig`, `/setlogs`, `/staffpanel` without Manage Server (config-panel bypass only) and `/botsettings`

## 3. /cmdconfig
- [ ] Disable `/kick` -> Mod gets "disabled"; also the staff-panel Kick button is refused
- [ ] Restrict `/warn` to a role / a channel -> enforced everywhere else; admin is NOT exempt
- [ ] `/cmdconfig` and `/botsettings` do not appear in the command list (cannot be restricted)
- [ ] Reset one / reset all (confirm step)

## 4. Logging
- [ ] `/setlogs set category:All channel:#logs`, `/listlogs` shows ACTIVE for all ten
- [ ] Trigger each: edit message, delete message, join, leave, ban, unban, timeout, role change (create/edit/delete + give/remove role), channel change, moderation case
- [ ] A ban done with `/ban` shows moderator + case in the Bans log (no "unknown")
- [ ] Remove bot's Send permission in #logs -> `/listlogs` shows "missing permissions"; delete the channel -> "channel missing"

## 5. Staff panel
- [ ] Member without Timeout Members/staff role is refused; add a staff role in Panel settings -> can open
- [ ] Member tools: select user -> Warn / Timeout / Kick / Ban modals; Kick/Ban require typing KICK/BAN
- [ ] History, Remove warning, Clear warnings (confirm), Channel tools (lock/unlock/slowmode/purge), Recent cases (filter + pages)
- [ ] Revoke Mod's permission while the panel is open, then click an action -> refused (permissions re-checked per click)
- [ ] Restart the bot, click buttons on an old panel -> still works (stateless)

## 6. AI moderation
- [ ] `/aimod` all 8 sections render; enable toggle; sensitivity; categories; threshold modal; per-category action; blocked-word action; timeout length modal; delete-on-punish toggle
- [ ] Add blocked words (modal), remove one, paging; a message containing one is actioned **with the AI provider disabled/broken**
- [ ] Alert / log / scope channels; exemptions (roles, channels, users); Administrator and server owner are never actioned
- [ ] With a real abusive test message: incident appears in log channel + Recent incidents
- [ ] Self-harm test phrase -> alert only; message NOT deleted, nobody warned/timed out
- [ ] **Fail-open:** set a bad key / unplug (e.g. wrong key in Railway) -> abusive messages are NOT actioned, bot stays up, Health shows "degraded" after repeated failures and recovers when fixed
- [ ] Edit a flagged message to clean text quickly -> no action on stale content

## 7. /botsettings (owner only)
- [ ] Non-owner: refused (also via old panel buttons)
- [ ] Owner: switch provider + model; provider without a key can't be selected; Test connection works; change appears in "Recent changes"; `/aimod` shows the new provider read-only

## 8. Info
- [ ] `/userinfo`, `/serverinfo`, `/avatar`, `/roleinfo`, `/systemstatus` render with consistent embeds and emojis

## 9. Restart/persistence
- [ ] Restart the Railway service: settings, cases, warnings, blocked words and AI config persist
