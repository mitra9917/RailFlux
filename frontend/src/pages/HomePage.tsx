import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { SyntheticSession } from '@/auth/synthetic-auth';
import { SyntheticAuthPanel } from '@/components/SyntheticAuthPanel';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const HERO_IMAGE = '/images/hero-station.jpg';

export function HomePage() {
  const navigate = useNavigate();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [date, setDate] = useState('2026-04-01');
  const [session, setSession] = useState<SyntheticSession | null>(null);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    const q = new URLSearchParams({ date });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    navigate(`/search?${q.toString()}`);
  }

  return (
    <div className="page-home -mt-14">
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden pt-14">
        <img
          src={HERO_IMAGE}
          alt=""
          className="absolute inset-0 size-full object-cover object-[center_42%]"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-white via-white/75 to-white/20" aria-hidden />

        <div className="relative mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[1fr_22rem] lg:py-12">
          <motion.div
            initial={{ opacity: 1, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="max-w-xl"
          >
            <p className="text-[13px] tracking-wide text-muted-foreground">Railway systems lab</p>
            <h1 className="mt-3 text-5xl font-semibold leading-[1.05] tracking-tight text-foreground sm:text-6xl">
              Built for
              <br />
              the rush.
            </h1>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-muted-foreground">
              Mint a synthetic JWT, then search → availability → book.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to={session ? `/search?from=${from}&to=${to}&date=${date}` : '/#sign-in'}
                className={cn(buttonVariants({ size: 'lg' }), 'rounded-full px-5')}
              >
                {session ? 'Search trains' : 'Sign in first'}
              </Link>
              <Link
                to="/experiments"
                className={cn(buttonVariants({ variant: 'ghost', size: 'lg' }), 'rounded-full px-5')}
              >
                Experiments
              </Link>
            </div>
          </motion.div>

          <div id="sign-in">
            <SyntheticAuthPanel onSessionChange={setSession} />
          </div>
        </div>

      <div className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-8 sm:px-8 sm:pb-10">
        <form
          onSubmit={onSearch}
          className="grid gap-4 rounded-3xl border border-border bg-background/95 p-6 shadow-sm backdrop-blur-sm sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end sm:p-7"
        >
          <Field label="From" htmlFor="home-from">
            <Input
              id="home-from"
              value={from}
              onChange={(e) => setFrom(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="any"
              className="h-11"
            />
          </Field>
          <Field label="To" htmlFor="home-to">
            <Input
              id="home-to"
              value={to}
              onChange={(e) => setTo(e.target.value.toUpperCase())}
              maxLength={3}
              placeholder="any"
              className="h-11"
            />
          </Field>
          <Field label="Journey date" htmlFor="home-date">
            <Input
              id="home-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              className="h-11"
            />
          </Field>
          <button
            type="submit"
            className="flex h-11 items-center justify-center rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Search
          </button>
        </form>
      </div>
      </section>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-[12px] font-normal text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
