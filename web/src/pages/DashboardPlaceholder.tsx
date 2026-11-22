import { Sparkles } from 'lucide-react';
import AppShell from '../components/AppShell';
import { EmptyState } from '../components/ui/EmptyState';

interface DashboardPlaceholderProps {
  title: string;
  description: string;
}

export default function DashboardPlaceholder({ title, description }: DashboardPlaceholderProps) {
  return (
    <AppShell title={title}>
      <EmptyState
        icon={Sparkles}
        title="Coming soon"
        description={description}
        action={
          <p className="rounded-xl bg-forest-50 px-4 py-2 text-sm font-medium text-forest-800 ring-1 ring-inset ring-forest-100">
            Dashboard content is built in the next step.
          </p>
        }
      />
    </AppShell>
  );
}
