import { RailFluxError } from './errors.js';

const STATION_CODE = /^[A-Z]{2,5}$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

function one(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

function invalid(message: string): never {
  throw new RailFluxError('VALIDATION_ERROR', message, 400);
}

function parseIsoDate(value: string): string {
  const m = ISO_DATE.exec(value);
  if (!m) invalid('Invalid date');
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() !== month - 1 ||
    probe.getUTCDate() !== day
  ) {
    invalid('Invalid date');
  }
  return value;
}

export type SearchTrainsQuery = {
  from: string | null;
  to: string | null;
  date: string;
};

function optionalStation(value: string | undefined, label: string): string | null {
  if (!value || !value.trim()) return null;
  const code = value.trim();
  if (!STATION_CODE.test(code)) invalid(`Invalid ${label} station`);
  return code;
}

/** OpenAPI `searchTrains` query parameters. */
export function parseSearchTrainsQuery(raw: Record<string, unknown>): SearchTrainsQuery {
  const date = one(raw.date);
  if (!date) invalid('Invalid date');

  return {
    from: optionalStation(one(raw.from), 'from'),
    to: optionalStation(one(raw.to), 'to'),
    date: parseIsoDate(date),
  };
}
