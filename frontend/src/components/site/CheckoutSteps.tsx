import { cn } from '@/lib/utils';

const STEPS = ['Passenger', 'Pay', 'Confirmed'] as const;

export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="flex flex-wrap gap-6 text-sm text-muted-foreground">
      {STEPS.map((label, i) => (
        <li
          key={label}
          className={cn(i === current && 'font-medium text-foreground', i < current && 'text-foreground/60')}
        >
          {label}
        </li>
      ))}
    </ol>
  );
}
