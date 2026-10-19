import type { NextFunction, Request, Response } from 'express';
import { Readable } from 'node:stream';

const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailers',
  'transfer-encoding',
  'upgrade',
]);

export function createUpstreamProxy(upstreamOrigin: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const target = new URL(req.originalUrl, upstreamOrigin);
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        const lower = key.toLowerCase();
        if (HOP_BY_HOP.has(lower) || lower === 'host') continue;
        if (value === undefined) continue;
        if (Array.isArray(value)) {
          for (const part of value) headers.append(key, part);
        } else {
          headers.set(key, value);
        }
      }

      const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
      const init: RequestInit & { duplex?: 'half' } = {
        method: req.method,
        headers,
      };
      if (hasBody) {
        init.body = Readable.toWeb(req) as BodyInit;
        init.duplex = 'half';
      }

      const upstream = await fetch(target, init);
      res.status(upstream.status);
      upstream.headers.forEach((value, key) => {
        if (HOP_BY_HOP.has(key.toLowerCase())) return;
        res.setHeader(key, value);
      });
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  };
}

export function pickUpstreamOrigin(
  config: { readUpstream: string; bookingUpstream: string },
  pathname: string,
): string | null {
  if (pathname.startsWith('/search') || pathname.startsWith('/availability')) {
    return config.readUpstream;
  }
  if (pathname.startsWith('/bookings')) {
    return config.bookingUpstream;
  }
  return null;
}
