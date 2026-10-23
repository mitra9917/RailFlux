import { useState } from 'react';
import { User } from 'lucide-react';
import { SyntheticAuthPanel } from '@/components/SyntheticAuthPanel';
import { loadStoredToken, type SyntheticSession } from '@/auth/synthetic-auth';
import { cn } from '@/lib/utils';

export function AccountMenu() {
  const [open, setOpen] = useState(false);
  const [session, setSession] = useState<SyntheticSession | null>(() => {
    const token = loadStoredToken();
    return token ? { userId: 'signed-in', cohort: 'browser', token } : null;
  });

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex size-8 items-center justify-center rounded-full border border-border bg-muted/70 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          session && 'border-foreground/15 bg-foreground text-background',
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        {session ? session.userId.slice(0, 1).toUpperCase() : <User className="size-3.5" strokeWidth={1.75} />}
        <span className="sr-only">{session ? 'Account' : 'Sign in'}</span>
      </button>
      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            aria-label="Close account"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-50 mt-3 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-background p-4 shadow-lg">
            <SyntheticAuthPanel onSessionChange={setSession} />
          </div>
        </>
      ) : null}
    </div>
  );
}
