import './load-env.js';
import { createEdgeApp } from './app.js';
import { loadEdgeConfig } from './config.js';

async function main() {
  const config = loadEdgeConfig();
  const app = createEdgeApp(config);

  app.listen(config.port, () => {
    console.log(
      JSON.stringify({
        event: 'server_started',
        architecture: 'optimized',
        service: 'edge',
        port: config.port,
        readUpstream: config.readUpstream,
        bookingUpstream: config.bookingUpstream,
      }),
    );
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
