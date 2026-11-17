import { ButtonStyle, type Guild } from 'discord.js';
import { CONFIGURABLE_KEYS, type CommandKey } from '../../../config/commandKeys.js';
import { buildCustomId } from '../../../interactions/customId.js';
import type { CommandRule } from '../../../permissions/accessRules.js';
import { button, row, stringSelect, type View } from '../../components/builders.js';
import { channelSelect, roleSelect } from '../../components/selects.js';
import { field, statusIcon, titled } from '../../embeds/base.js';
import { truncate } from '../../../utils/text.js';

const pickRow = (rules: Map<string, CommandRule>, current?: string) =>
  row(
    stringSelect(
      buildCustomId('cc', 'pick'),
      'Choose a command to configure…',
      CONFIGURABLE_KEYS.map((k) => {
        const r = rules.get(k);
        const state = !r ? 'default' : !r.enabled ? 'disabled' : r.roleIds.length || r.channelIds.length ? 'restricted' : 'default';
        return { label: `/${k}`, value: k, description: state, emoji: 'command' as const, default: k === current };
      }),
    ),
  );

const describe = (r: CommandRule | undefined) =>
  !r ? 'Default (enabled, no restrictions)' : [r.enabled ? 'Enabled' : 'Disabled', r.roleIds.length ? `Roles: ${r.roleIds.map((x) => `<@&${x}>`).join(' ')}` : 'Roles: any', r.channelIds.length ? `Channels: ${r.channelIds.map((x) => `<#${x}>`).join(' ')}` : 'Channels: any'].join('\n');

export function overviewView(rules: Map<string, CommandRule>): View {
  const custom = [...rules.values()].filter((r) => !r.enabled || r.roleIds.length || r.channelIds.length);
  const embed = titled('primary', 'command', 'Command configuration', 'Enable, disable or restrict commands per role and channel. Restrictions **narrow** access (they never grant permissions) and are enforced on every use, including the staff panel. `/cmdconfig` and `/botsettings` can never be restricted.');
  if (custom.length === 0) embed.addFields(field('Current restrictions', 'None. All commands use their defaults.'));
  else embed.addFields(custom.slice(0, 20).map((r) => field(`${statusIcon(r.enabled)} /${r.commandKey}`, truncate(describe(r), 1000))));
  return { embeds: [embed], components: [pickRow(rules), row(button(buildCustomId('cc', 'resetall'), 'Reset all restrictions', ButtonStyle.Danger, 'reset', custom.length === 0))] };
}

export function commandView(key: CommandKey, rules: Map<string, CommandRule>, guild: Guild): View {
  const r = rules.get(key);
  const embed = titled('primary', 'command', `/${key}`, describe(r)).addFields(
    field('How it works', 'Leave roles / channels empty for "no restriction". Only members with one of the selected roles, in one of the selected channels, can use the command.'),
  );
  return {
    embeds: [embed],
    components: [
      pickRow(rules, key),
      row(roleSelect(buildCustomId('cc', 'roles', key), 'Allowed roles (empty = any)', r?.roleIds ?? [], guild)),
      row(channelSelect(buildCustomId('cc', 'chans', key), 'Allowed channels (empty = any)', r?.channelIds ?? [], guild)),
      row(
        button(buildCustomId('cc', 'toggle', key), r && !r.enabled ? 'Enable' : 'Disable', r && !r.enabled ? ButtonStyle.Success : ButtonStyle.Danger, r && !r.enabled ? 'enabled' : 'disabled'),
        button(buildCustomId('cc', 'reset', key), 'Reset this command', ButtonStyle.Secondary, 'reset'),
        button(buildCustomId('cc', 'home'), 'Back', ButtonStyle.Secondary, 'back'),
      ),
    ],
  };
}

export function confirmResetAllView(): View {
  return {
    embeds: [titled('warning', 'warning', 'Reset all command restrictions?', 'Every command will return to its default: enabled, with no role or channel restrictions.')],
    components: [row(button(buildCustomId('cc', 'resetallok'), 'Yes, reset everything', ButtonStyle.Danger, 'reset'), button(buildCustomId('cc', 'home'), 'Cancel', ButtonStyle.Secondary, 'back'))],
  };
}
