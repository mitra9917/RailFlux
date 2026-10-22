import { signSyntheticJwt } from '@railflux/shared/synthetic-jwt';

const STORAGE_KEY = 'railflux.synthetic.bearer';

export type SyntheticSession = {
  userId: string;
  cohort: string;
  token: string;
};

export function loadStoredToken(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token: string): void {
  sessionStorage.setItem(STORAGE_KEY, token);
}

export function clearStoredToken(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export async function mintSyntheticSession(options: {
  userId: string;
  cohort?: string;
  secret: string;
}): Promise<SyntheticSession> {
  const cohort = options.cohort?.trim() || 'browser';
  const token = await signSyntheticJwt(options.secret, {
    userId: options.userId,
    cohort,
  });
  storeToken(token);
  return { userId: options.userId, cohort, token };
}
