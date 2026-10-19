import './load-env.js';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import { createReadApp } from './app.js';
import { loadReadConfig } from './config.js';

async function main() {
  const config = loadReadConfig();
  const pool = createPool({
    nodeEnv: config.nodeEnv,
    port: config.port,
    profile: 'baseline',
    syntheticJwtSecret: config.syntheticJwtSecret,
    mysql: config.mysql,
  });
  const app = createReadApp(config, pool);

  const server = app.listen(config.port, () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        architecture: config.profile,
        service: 'read',
        port: config.port,
      }),
    );
  });

  const dbOk = await pingDatabase(pool);
  if (!dbOk) {
    console.warn(
      JSON.stringify({
        event: 'mysql_unreachable',
        service: 'read',
        host: config.mysql.host,
        port: config.mysql.port,
        database: config.mysql.database,
      }),
    );
  } else {
    console.log(JSON.stringify({ event: 'mysql_connected', service: 'read' }));
  }

  const shutdown = async (signal: string) => {
    console.log(JSON.stringify({ event: 'shutdown', service: 'read', signal }));
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
