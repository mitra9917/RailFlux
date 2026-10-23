export type JourneyTrace = {
  searchMs?: number;
  availabilityMs?: number;
  bookingMs?: number;
  cacheStatus?: string | null;
  inventoryId?: string;
  trainRunId?: string;
  travelClass?: string;
  quota?: string;
  trainNo?: string;
  trainName?: string;
  from?: string;
  to?: string;
  date?: string;
  passengerName?: string;
  passengerAge?: number;
  userId?: string;
};

const KEY = 'railflux.journey.trace';

export function readJourneyTrace(): JourneyTrace | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as JourneyTrace;
  } catch {
    return null;
  }
}

export function patchJourneyTrace(partial: JourneyTrace): JourneyTrace {
  const next = { ...readJourneyTrace(), ...partial };
  try {
    sessionStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // sessionStorage may be unavailable
  }
  return next;
}

/** Rebuild the Pay URL so a declined booking can retry with a new idempotency key. */
export function payHrefFromJourney(
  journey: JourneyTrace | null,
  extras: Record<string, string> = {},
): string {
  const q = new URLSearchParams();
  const put = (key: string, value?: string | number | null) => {
    if (value == null || value === '') return;
    q.set(key, String(value));
  };
  put('inventoryId', journey?.inventoryId);
  put('trainRunId', journey?.trainRunId);
  put('class', journey?.travelClass);
  put('quota', journey?.quota);
  put('trainNo', journey?.trainNo);
  put('name', journey?.trainName);
  put('from', journey?.from);
  put('to', journey?.to);
  put('date', journey?.date);
  put('pax', journey?.passengerName);
  put('age', journey?.passengerAge);
  for (const [key, value] of Object.entries(extras)) {
    if (value) q.set(key, value);
  }
  return `/pay?${q.toString()}`;
}
