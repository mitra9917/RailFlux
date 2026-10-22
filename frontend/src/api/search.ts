import type { Availability, SearchTrainsResponse, TravelClass } from '@railflux/shared/api-types';
import { apiFetch, parseApiJson } from './client';

export type SearchParams = {
  from: string;
  to: string;
  date: string;
};

export type AvailabilityParams = {
  trainRunId: string;
  class: TravelClass;
  quota: 'TATKAL';
};

export async function searchTrains(params: SearchParams): Promise<SearchTrainsResponse> {
  const q = new URLSearchParams({
    from: params.from.trim().toUpperCase(),
    to: params.to.trim().toUpperCase(),
    date: params.date.trim(),
  });
  const res = await apiFetch(`/v1/search?${q.toString()}`);
  return parseApiJson<SearchTrainsResponse>(res);
}

export async function getAvailability(params: AvailabilityParams): Promise<Availability> {
  const q = new URLSearchParams({
    trainRunId: params.trainRunId,
    class: params.class,
    quota: params.quota,
  });
  const res = await apiFetch(`/v1/availability?${q.toString()}`);
  return parseApiJson<Availability>(res);
}
