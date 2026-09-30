'use client';

import { FcEmptyState, FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function AnnouncementsPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="Community"
      title="Announcements"
      subtitle="A dedicated space for community notices."
    >
      <FcEmptyState
        title="You’re all caught up"
        description="Check your notifications for match reminders, invitations and updates from your leagues."
        actionLabel="Open Notifications"
        actionHref="/notifications"
      />

      <FcPanel className="p-5">
        <p className="text-sm leading-6 text-slate-500">
          League-specific information can still be accessed from each League Overview and Tournament page.
        </p>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
