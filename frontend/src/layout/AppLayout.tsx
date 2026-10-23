import { NavLink } from 'react-router-dom';
import { AnimatedOutlet } from '@/components/app/AnimatedOutlet';
import { AccountMenu } from '@/components/site/AccountMenu';
import { cn } from '@/lib/utils';

const nav: { to: string; label: string; end?: boolean }[] = [
  { to: '/', label: 'Home', end: true },
  { to: '/search', label: 'Search' },
  { to: '/experiments', label: 'Experiments' },
  { to: '/architecture', label: 'Architecture' },
  { to: '/about', label: 'About' },
];

export function AppLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-black/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5 sm:px-8">
          <NavLink to="/" end className="text-[15px] font-medium tracking-tight text-foreground no-underline">
            RailFlux
          </NavLink>
          <nav className="hidden items-center gap-7 text-[13px] text-muted-foreground md:flex" aria-label="Main">
            {nav.map(({ to, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  cn(
                    'no-underline transition-colors hover:text-foreground',
                    isActive && 'text-foreground',
                  )
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <nav className="flex gap-4 text-[13px] text-muted-foreground md:hidden" aria-label="Main">
              {nav.slice(1, 3).map(({ to, label }) => (
                <NavLink key={to} to={to} className="no-underline hover:text-foreground">
                  {label}
                </NavLink>
              ))}
            </nav>
            <AccountMenu />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-12 sm:px-8 sm:py-16 [&:has(.page-home)]:max-w-none [&:has(.page-home)]:px-0 [&:has(.page-home)]:py-0 [&:has(.page-wide)]:max-w-6xl">
        <AnimatedOutlet />
      </main>
    </div>
  );
}
