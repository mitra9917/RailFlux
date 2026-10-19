import { HEADER_RUN_ID } from './constants.js';

/** OpenAPI `RunIdHeader` pattern (optional on requests). */
export const RUN_ID_PATTERN = /^[a-zA-Z0-9_-]{8,64}$/;

export function parseOptionalRunId(value: string | undefined): string | undefined {
  if (value === undefined || value === '') {
    return undefined;
  }
  if (!RUN_ID_PATTERN.test(value)) {
    return undefined;
  }
  return value;
}

export function readRunIdHeader(
  headers: Record<string, string | string[] | undefined>,
): string | undefined {
  const raw = headers[HEADER_RUN_ID.toLowerCase()] ?? headers[HEADER_RUN_ID];
  const value = typeof raw === 'string' ? raw : raw?.[0];
  return parseOptionalRunId(value);
}
