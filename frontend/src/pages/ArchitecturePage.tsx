import { ArchitectureFlows } from '@/components/architecture/ArchitectureFlows';
import { PageShell } from '@/components/app/PageShell';

export function ArchitecturePage() {
  return (
    <PageShell
      wide
      title="System architectures"
      lead="The same booking, two request paths. Watch the glow move with the work."
    >
      <ArchitectureFlows />
    </PageShell>
  );
}
