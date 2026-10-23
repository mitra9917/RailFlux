import { Outlet } from 'react-router-dom';

/** Instant route swap — no fade that blanks the next page. */
export function AnimatedOutlet() {
  return <Outlet />;
}
