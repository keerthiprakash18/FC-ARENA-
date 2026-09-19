'use client';

import { FcMenuRow, FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function SettingsPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="Account"
      title="Settings"
      subtitle="Account and app settings are separated into focused screens."
    >
      <div className="grid gap-3 md:grid-cols-2">
        <FcMenuRow
          href="/profile"
          icon="✎"
          title="Profile"
          description="Identity and player account details"
        />

        <FcMenuRow
          href="/notifications"
          icon="◉"
          title="Notifications"
          description="Notification center and read status"
        />

        <FcMenuRow
          href="/privacy"
          icon="◈"
          title="Privacy"
          description="Privacy and account data information"
        />

        <FcMenuRow
          href="/help"
          icon="?"
          title="Help"
          description="FC ARENA workflow support"
        />
      </div>

      <FcPanel className="p-5">
        <p className="text-sm leading-6 text-slate-500">
          Appearance and theme preferences are not exposed by the current backend, so this page does not show controls that cannot be persisted.
        </p>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
