import type { TravelClass } from '@railflux/shared/api-types';

export const CLASS_LABEL: Record<TravelClass, string> = {
  SL: 'Sleeper',
  '3A': '3 AC',
  '2A': '2 AC',
};

export function classLabel(code: string): string {
  if (code === 'SL' || code === '3A' || code === '2A') return CLASS_LABEL[code];
  return code;
}
