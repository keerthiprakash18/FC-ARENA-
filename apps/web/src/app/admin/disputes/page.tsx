'use client';

import Link from 'next/link';

import { AdminNavigation } from '@/components/admin/admin-navigation';
import { FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function AdminDisputesPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="Disputes"
      subtitle="Match disputes are handled in the existing Match Details workflow."
    >
      <AdminNavigation />

      <FcPanel className="p-6">
        <h2 className="text-xl font-black">
          Match-level dispute handling
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          There is no standalone global dispute-list API in the current backend. Open Match Center and select the relevant Match to review its verification and dispute state.
        </p>

        <Link
          href="/matches"
          className="mt-5 inline-flex rounded-xl border border-red-400/20 px-5 py-3 text-sm font-black text-red-300"
        >
          Open Match Center
        </Link>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
