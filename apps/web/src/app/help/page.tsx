'use client';

import { FcMenuRow, FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function HelpPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="Support"
      title="Help"
      subtitle="Open the feature that matches the issue so FC ARENA keeps the correct League, Tournament or Match context."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <FcMenuRow
          href="/leagues"
          icon="◈"
          title="League Help"
          description="Memberships, join codes and League management"
        />

        <FcMenuRow
          href="/tournaments"
          icon="◇"
          title="Tournament Help"
          description="Registration, groups, standings and brackets"
        />

        <FcMenuRow
          href="/fixtures"
          icon="⚽"
          title="Fixture Help"
          description="Schedules and match navigation"
        />

        <FcMenuRow
          href="/matches"
          icon="✓"
          title="Result Help"
          description="Result submission and verification"
          tone="emerald"
        />
      </div>

      <FcPanel className="p-5">
        <p className="text-sm leading-6 text-slate-500">
          A dedicated support-ticket backend is not currently exposed, so this page routes users into the correct existing workflow instead of presenting a non-functional contact form.
        </p>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
