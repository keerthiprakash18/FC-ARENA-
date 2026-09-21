import Link from 'next/link';

import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

export default function HelpPage() {
  return (
    <PublicInfoPage
      eyebrow="Support"
      title="Help & Support"
      description="Use the section that matches your issue. FC ARENA keeps League, Tournament and Match actions inside their real competition context."
    >
      <PublicInfoCard
        title="Getting started"
        icon="profile"
      >
        <p>
          Sign in to access your player profile, League memberships, Tournaments, Fixtures, results and career history.
        </p>

        <Link
          href="/login"
          className="theme-text-link inline-flex min-h-10 items-center font-semibold"
        >
          Sign in to FC ARENA
        </Link>
      </PublicInfoCard>

      <PublicInfoCard
        title="League & Tournament help"
        icon="tournament"
      >
        <p>
          League joins use the existing League workflow. Tournament registration, groups, teams, standings and fixtures remain inside the selected League or Tournament.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Match result help"
        icon="result"
      >
        <p>
          Result submission, OCR verification, confirmed results and disputes are handled from the relevant Match Center so the correct fixture and permissions are preserved.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Support availability"
        icon="help"
      >
        <p>
          FC ARENA does not currently expose a dedicated support-ticket backend. This page therefore avoids a fake contact form and routes users through the working product flows.
        </p>
      </PublicInfoCard>
    </PublicInfoPage>
  );
}
