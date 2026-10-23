import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AdvisoryBanner } from '@/components/AdvisoryBanner';
import { loadStoredToken } from '@/auth/synthetic-auth';
import { getSyntheticUserId } from '@/config/env';
import { generateIdempotencyKey } from '@/lib/idempotency-key';
import { patchJourneyTrace } from '@/lib/journey-trace';
import { CheckoutSteps } from '@/components/site/CheckoutSteps';
import { JourneySummary } from '@/components/site/JourneySummary';
import { PageShell } from '@/components/app/PageShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BookPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inventoryId = searchParams.get('inventoryId')?.trim() ?? '';
  const trainRunId = searchParams.get('trainRunId')?.trim() ?? '';
  const travelClass = searchParams.get('class')?.trim() ?? '';
  const quota = searchParams.get('quota')?.trim() ?? '';
  const trainNo = searchParams.get('trainNo') ?? '';
  const trainName = searchParams.get('name') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const date = searchParams.get('date') ?? '';
  const hasAvailabilityContext = Boolean(inventoryId);

  const [passengerName, setPassengerName] = useState('');
  const [passengerAge, setPassengerAge] = useState(30);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => generateIdempotencyKey());
  const signedIn = useMemo(() => Boolean(loadStoredToken()), []);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!hasAvailabilityContext) {
      setError('Pick a train from Search first.');
      return;
    }
    if (!signedIn) {
      setError('Sign in from the account menu first.');
      return;
    }
    patchJourneyTrace({
      inventoryId,
      trainRunId,
      travelClass,
      quota,
      trainNo,
      trainName,
      from,
      to,
      date,
      passengerName: passengerName.trim(),
      passengerAge,
      userId: getSyntheticUserId(),
    });
    const q = new URLSearchParams(searchParams);
    q.set('pax', passengerName.trim());
    q.set('age', String(passengerAge));
    q.set('idem', idempotencyKey);
    navigate(`/pay?${q.toString()}`);
  }

  return (
    <PageShell title="Passenger" lead="Synthetic details only. No real identity.">
      <CheckoutSteps current={0} />
      {!hasAvailabilityContext ? (
        <p className="text-sm text-muted-foreground">
          Start from <Link to="/search">Search</Link>.
        </p>
      ) : (
        <div className="grid gap-10 lg:grid-cols-[1fr_16rem]">
          <form className="max-w-md space-y-6" onSubmit={onSubmit}>
            <div className="space-y-2">
              <Label htmlFor="pax-name" className="text-muted-foreground">
                Name
              </Label>
              <Input
                id="pax-name"
                value={passengerName}
                onChange={(e) => setPassengerName(e.target.value)}
                maxLength={80}
                required
                placeholder="Synthetic name"
                className="h-11 border-0 bg-muted/70"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="pax-age" className="text-muted-foreground">
                Age
              </Label>
              <Input
                id="pax-age"
                type="number"
                min={1}
                max={120}
                value={passengerAge}
                onChange={(e) => setPassengerAge(Number(e.target.value))}
                className="h-11 w-28 border-0 bg-muted/70"
              />
            </div>
            <Button type="submit" className="rounded-full px-6" disabled={!signedIn}>
              Continue to payment
            </Button>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <AdvisoryBanner />
          </form>
          <JourneySummary
            trainNo={trainNo}
            trainName={trainName}
            from={from}
            to={to}
            date={date}
            travelClass={travelClass}
          />
        </div>
      )}
    </PageShell>
  );
}
