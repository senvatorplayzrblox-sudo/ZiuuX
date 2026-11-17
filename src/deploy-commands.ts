import { REST, Routes } from "discord.js";
import { config } from "./config.js";
import { commands } from "./commands/definitions.js";

const rest = new REST({ version: "10" }).setToken(config.token);
await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
console.log(`Registered ${commands.length} global commands.`);
