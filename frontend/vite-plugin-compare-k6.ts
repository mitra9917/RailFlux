import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { checkK6Installed, runPairedK6Burst } from '../scripts/compare-k6-burst.mjs';

const PATH = '/__railflux/compare-k6';

let busy = false;

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function attachCompareK6(middlewares: { use: (fn: (req: IncomingMessage, res: ServerResponse, next: () => void) => void) => void }): void {
  middlewares.use((req, res, next) => {
    const url = req.url?.split('?')[0];
    if (url !== PATH) {
      next();
      return;
    }

    void (async () => {
      if (req.method === 'GET') {
        sendJson(res, 200, {
          k6: await checkK6Installed(),
          busy,
        });
        return;
      }

      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'Method not allowed' });
        return;
      }

      if (busy) {
        sendJson(res, 409, { error: 'A live k6 compare is already running.' });
        return;
      }

      busy = true;
      try {
        const body = await readJson(req);
        const token = typeof body.token === 'string' ? body.token : '';
        const result = await runPairedK6Burst({ token: token || undefined });
        sendJson(res, 200, result);
      } catch (err) {
        sendJson(res, 500, {
          error: err instanceof Error ? err.message : 'k6 compare failed',
        });
      } finally {
        busy = false;
      }
    })();
  });
}

export function compareK6Plugin(): Plugin {
  return {
    name: 'railflux-compare-k6',
    configureServer(server) {
      attachCompareK6(server.middlewares);
    },
    configurePreviewServer(server) {
      attachCompareK6(server.middlewares);
    },
  };
}
