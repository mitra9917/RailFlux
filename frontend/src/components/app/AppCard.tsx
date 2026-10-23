import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Props = {
  title?: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
};

export function AppCard({ title, subtitle, className, children }: Props) {
  return (
    <Card className={cn('shadow-sm', className)}>
      {title ? (
        <CardHeader className="border-b border-border/60">
          <CardTitle className="text-lg font-semibold tracking-tight">{title}</CardTitle>
          {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
        </CardHeader>
      ) : null}
      <CardContent className={title ? 'pt-6' : 'pt-(--card-spacing)'}>{children}</CardContent>
    </Card>
  );
}
