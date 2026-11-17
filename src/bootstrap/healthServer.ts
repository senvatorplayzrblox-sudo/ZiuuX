import { createServer, type Server } from 'node:http';

let discordReady = false;
export const setDiscordReady = (v: boolean) => { discordReady = v; };

/** Railway health check. 200 only when Discord is ready AND MongoDB is connected. Exposes no sensitive data. */
export function startHealthServer(port: number, isMongoUp: () => boolean): Server {
  const server = createServer((req, res) => {
    if (req.url === '/health' || req.url === '/') {
      const mongo = isMongoUp();
      const ok = discordReady && mongo;
      res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: ok ? 'ok' : 'starting', discord: discordReady, mongo }));
      return;
    }
    res.writeHead(404).end();
  });
  server.listen(port);
  return server;
}
