import type { ModuleHandlers } from '../core/registry/InteractionRegistry.js';
import { aimodHandler } from './aimod/handler.js';
import { botsettingsHandler } from './botsettings/handler.js';
import { cmdconfigHandler } from './cmdconfig/handler.js';
import { staffpanelHandler } from './staffpanel/handler.js';

/** custom-id module code -> handler. sp=staffpanel, am=aimod, cc=cmdconfig, bs=botsettings. */
export const MODULE_HANDLERS: ModuleHandlers = { sp: staffpanelHandler, am: aimodHandler, cc: cmdconfigHandler, bs: botsettingsHandler };
