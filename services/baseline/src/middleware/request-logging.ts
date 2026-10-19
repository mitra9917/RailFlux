import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import {
  HEADER_REQUEST_ID,
  HEADER_RUN_ID,
  readRunIdHeader,
} from '@railflux/shared';
import { operationFromPath } from '../logging/http-operation.js';

export type RequestLogWriter = (entry: Record<string, unknown>) => void;

export function createRequestLoggingMiddleware(
  architecture: 'baseline',
  write: RequestLogWriter = (entry) => console.log(JSON.stringify(entry)),
): RequestHandler {
  return (req, res, next) => {
    const started = process.hrtime.bigint();
    const requestId = randomUUID();
    const runId = readRunIdHeader(req.headers);
    const runIdHeaderRaw = req.headers[HEADER_RUN_ID.toLowerCase()];
    const runIdRejected =
      runIdHeaderRaw !== undefined &&
      runIdHeaderRaw !== '' &&
      runId === undefined;

    req.requestId = requestId;
    if (runId) {
      req.runId = runId;
    }

    res.setHeader(HEADER_REQUEST_ID, requestId);

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - started) / 1_000_000;
      const entry: Record<string, unknown> = {
        event: 'http_request',
        architecture,
        request_id: requestId,
        method: req.method,
        path: req.path,
        operation: operationFromPath(req.path),
        status: res.statusCode,
        duration_ms: Math.round(durationMs * 1000) / 1000,
      };
      if (runId) {
        entry.run_id = runId;
      }
      if (runIdRejected) {
        entry.run_id_rejected = true;
      }
      write(entry);
    });

    next();
  };
}
