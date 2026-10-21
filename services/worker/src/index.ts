import './load-env.js';
import { createPool, pingDatabase } from '@railflux/baseline/db.js';
import {
  createSideEffectsSqsClient,
  loadSideEffectsSqsConfig,
} from '@railflux/baseline/services/outbox-sqs-publisher.js';
import { pollSideEffectsQueueOnce } from './consume-side-effects.js';
import { loadWorkerConfig } from './config.js';

async function main() {
  const config = loadWorkerConfig();
  const sqsConfig = loadSideEffectsSqsConfig();
  const sqsClient = createSideEffectsSqsClient(sqsConfig);

  const pool = createPool({
    nodeEnv: config.nodeEnv,
    port: 0,
    profile: 'baseline',
    syntheticJwtSecret: config.syntheticJwtSecret,
    mysql: config.mysql,
  });

  const dbOk = await pingDatabase(pool);
  if (!dbOk) {
    console.warn(JSON.stringify({ event: 'mysql_unreachable', service: 'worker' }));
  } else {
    console.log(JSON.stringify({ event: 'mysql_connected', service: 'worker' }));
  }

  console.log(
    JSON.stringify({
      event: 'worker_started',
      service: 'worker',
      queueUrl: sqsConfig.queueUrl,
      waitSeconds: config.sqsWaitSeconds,
    }),
  );

  let running = true;
  const shutdown = async (signal: string) => {
    running = false;
    console.log(JSON.stringify({ event: 'shutdown', service: 'worker', signal }));
    await pool.end();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  while (running) {
    try {
      const stats = await pollSideEffectsQueueOnce(
        pool,
        sqsClient,
        sqsConfig.queueUrl,
        config.sqsWaitSeconds,
      );
      if (stats.received > 0) {
        console.log(JSON.stringify({ event: 'worker_poll', service: 'worker', ...stats }));
      }
    } catch (err) {
      console.error(
        JSON.stringify({
          event: 'worker_poll_error',
          service: 'worker',
          message: err instanceof Error ? err.message : String(err),
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
