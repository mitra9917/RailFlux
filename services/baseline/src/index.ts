import './load-env.js';
import { loadConfig } from './config.js';
import { createApp } from './app.js';
import { createPool, pingDatabase } from './db.js';

async function main() {
  const config = loadConfig();
  const pool = createPool(config);
  const app = createApp(config, pool);

  const server = app.listen(config.port, () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        profile: config.profile,
        port: config.port,
      }),
    );
  });

  const dbOk = await pingDatabase(pool);
  if (!dbOk) {
    console.warn(
      JSON.stringify({
        event: 'mysql_unreachable',
        host: config.mysql.host,
        port: config.mysql.port,
        database: config.mysql.database,
      }),
    );
  } else {
    console.log(JSON.stringify({ event: 'mysql_connected' }));
  }

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ event: 'shutdown', signal }));
    server.close();
    await pool.end();
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
