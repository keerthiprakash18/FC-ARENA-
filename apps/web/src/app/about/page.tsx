'use client';

import { FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function AboutPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="FC ARENA"
      title="About"
      subtitle="More Than A Game."
    >
      <FcPanel className="p-6 sm:p-8">
        <p className="text-sm leading-7 text-slate-400">
          FC ARENA is a football competition community platform for League memberships, Tournament management, fixture generation, verified results, standings, knockout progression and player career history.
        </p>

        <p className="mt-5 font-mono text-xs text-slate-600">
          App Version 1.0.0
        </p>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
