'use client';

import Link from 'next/link';

import { AdminNavigation } from '@/components/admin/admin-navigation';
import { FcPanel } from '@/components/fc/fc-ui';
import { SecondaryFeaturePage } from '@/components/fc/secondary-feature-page';

export default function AdminResultsPage() {
  return (
    <SecondaryFeaturePage
      eyebrow="Admin"
      title="Result Verification"
      subtitle="Result review remains connected to the existing Match Center and individual Match Details screens."
    >
      <AdminNavigation />

      <FcPanel className="p-6">
        <h2 className="text-xl font-black">
          Open Match Center
        </h2>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          The current backend exposes result submission, evidence and verification in Match context rather than a separate global verification queue.
        </p>

        <Link
          href="/matches"
          className="mt-5 inline-flex rounded-xl bg-emerald-400 px-5 py-3 text-sm font-black text-[#031019]"
        >
          Review Matches
        </Link>
      </FcPanel>
    </SecondaryFeaturePage>
  );
}
