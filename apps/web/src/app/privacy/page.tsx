'use client';

import { FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function PrivacyPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="Account"
      title="Privacy"
      subtitle="How privacy-related information is currently handled in the FC ARENA app."
    >
      <FcPanel className="p-5 sm:p-6">
        <h2 className="text-lg font-black">
          Player Data
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          FC ARENA uses the existing authenticated profile, League membership, Tournament entry and Match records to provide competition features. This frontend refactor does not change how those records are stored or accessed.
        </p>
      </FcPanel>

      <FcPanel className="p-5 sm:p-6">
        <h2 className="text-lg font-black">
          Privacy Controls
        </h2>

        <p className="mt-3 text-sm leading-7 text-slate-500">
          The current backend does not expose dedicated privacy-preference fields. No fake toggles are shown here. Profile data can be reviewed from the Profile screen.
        </p>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
