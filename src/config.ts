import "dotenv/config";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const config = {
  token: required("DISCORD_TOKEN"),
  clientId: required("CLIENT_ID"),
  mongoUri: required("MONGODB_URI"),
  guildId: process.env.GUILD_ID?.trim() || undefined,
  configBypassUserId: "1418875905085935637"
};
