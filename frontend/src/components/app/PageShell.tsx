import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  eyebrow?: string;
  title?: string;
  lead?: string;
  wide?: boolean;
  children: ReactNode;
};

export function PageShell({ eyebrow, title, lead, wide, children }: Props) {
  return (
    <div className={cn('flex flex-col gap-6', wide && 'page-wide max-w-none')}>
      {title || eyebrow ? (
        <header className="space-y-2">
          {eyebrow ? (
            <p className="text-[13px] text-muted-foreground">{eyebrow}</p>
          ) : null}
          {title ? (
            <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
              {title}
            </h1>
          ) : null}
          {lead ? <p className="max-w-xl text-[17px] leading-relaxed text-muted-foreground">{lead}</p> : null}
        </header>
      ) : null}
      <div className="flex flex-col gap-5">{children}</div>
    </div>
  );
}
