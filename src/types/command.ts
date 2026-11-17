import type { ChatInputCommandInteraction, RESTPostAPIChatInputApplicationCommandsJSONBody } from 'discord.js';
import type { CommandKey } from '../config/commandKeys.js';
import type { ZiuuXClient } from '../client/ZiuuXClient.js';

/**
 * public     - anyone (still subject to /cmdconfig)
 * moderation - requires the listed Discord permission(s); fine-grained checks happen in ModerationService
 * config     - ManageGuild / Administrator, plus the owner-gate bypass (ZiuuX config panels only)
 * staff      - staff panel access rule (staff role or ModerateMembers), plus the owner-gate bypass
 * owner      - bot owner only (/botsettings)
 */
export type CommandAccess = 'public' | 'moderation' | 'config' | 'staff' | 'owner';

export interface CommandContext {
  client: ZiuuXClient;
  interaction: ChatInputCommandInteraction;
}

export interface Command {
  key: CommandKey;
  data: { name: string; toJSON(): RESTPostAPIChatInputApplicationCommandsJSONBody };
  access: CommandAccess;
  guildOnly: boolean;
  /** Permission FLAGS required for 'moderation' commands (pipeline pre-check; ModerationService re-checks precisely). */
  requiredUserPerms?: bigint[];
  /** ephemeral = defer ephemerally before executing (use for anything that may take > 3s). */
  defer: 'ephemeral' | 'none';
  execute(ctx: CommandContext): Promise<void>;
}
