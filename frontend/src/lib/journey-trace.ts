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
