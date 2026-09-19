'use client';

import {
  FcMenuRow,
  FcPanel,
} from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function MatchSystemPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="Competition"
      title="Match System"
      subtitle="Open the correct FC ARENA match workflow without mixing admin controls into the player Fixtures screen."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <FcMenuRow
          href="/fixtures"
          icon="⚽"
          title="Fixtures"
          description="Player-facing League and Tournament match schedule"
        />

        <FcMenuRow
          href="/matches"
          icon="✓"
          title="Results"
          description="Match details, result submission and verification"
          tone="emerald"
        />

        <FcMenuRow
          href="/fixtures/manage"
          icon="⚙"
          title="Fixture Management"
          description="Admin schedule and Tournament fixture controls"
          tone="amber"
        />

        <FcMenuRow
          href="/fixtures/generator"
          icon="＋"
          title="Fixture Generator"
          description="Dedicated five-step fixture creation workflow"
          tone="cyan"
        />
      </div>

      <FcPanel className="p-5">
        <p className="text-sm leading-6 text-slate-500">
          Match evidence, verification and dispute data remains on each existing Match Details screen so the normal fixture list stays focused.
        </p>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
