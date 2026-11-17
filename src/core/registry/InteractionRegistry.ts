import type { MessageComponentInteraction, ModalSubmitInteraction } from 'discord.js';
import type { ZiuuXClient } from '../../client/ZiuuXClient.js';
import type { ModuleId } from '../../interactions/customId.js';

export interface ComponentCtx {
  client: ZiuuXClient;
  interaction: MessageComponentInteraction | ModalSubmitInteraction;
  action: string;
  args: string[];
}

export interface ModuleHandler {
  /** Authorisation is re-evaluated by the handler on EVERY interaction (nothing is trusted from the custom id). */
  handle(ctx: ComponentCtx): Promise<void>;
}

export type ModuleHandlers = Record<ModuleId, ModuleHandler>;
