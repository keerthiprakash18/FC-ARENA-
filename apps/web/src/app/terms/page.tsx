import Link from 'next/link';

import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

export default function TermsPage() {
  return (
    <PublicInfoPage
      eyebrow="Legal & Community Rules"
      title="FC ARENA Terms of Service"
      description="These Terms and Community Rules describe the conditions for using FC ARENA as a player, League member, Tournament participant or administrator. By accepting them, you agree to follow these rules whenever you create, upload or interact with FC ARENA community and competition content."
    >
      <PublicInfoCard
        title="Use of the platform"
        icon="shield"
      >
        <p>
          Use FC ARENA only for lawful football esports competition and community activity. Do not attempt to access another user&apos;s account, bypass permissions, interfere with the service, manipulate results, exploit technical vulnerabilities or use FC ARENA to facilitate unlawful activity.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Community content rules"
        icon="profile"
      >
        <p>
          User-generated content includes player names and profile photos, League and Tournament names or descriptions, team content, result evidence, dispute text, safety reports and other content that users submit or make visible to other FC ARENA users.
        </p>

        <p>
          You must not create, upload or share content that contains or promotes harassment, bullying, hate or abusive conduct, sexual content or nudity, graphic violence, threats, scams, spam, impersonation, illegal activity, child exploitation or abuse, or content that infringes another person&apos;s copyright, trademark or other intellectual-property rights.
        </p>

        <p>
          Do not use another person&apos;s personal information, identity, image, club branding or protected content in a misleading, abusive or unlawful way.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Reporting, blocking & moderation"
        icon="shield"
      >
        <p>
          FC ARENA provides in-app Safety &amp; Reporting controls so users can report inappropriate player profiles or community content and block other players where supported. Reports may be reviewed by FC ARENA moderation and appropriate action may include warning, restricting, removing or suspending content or accounts where necessary.
        </p>

        <p>
          Blocking does not erase official fixtures, verified results, standings, audit records or other competition records that must remain available to preserve competitive integrity.
        </p>

        <Link
          href="/safety"
          className="theme-text-link font-semibold underline underline-offset-4"
        >
          Open Safety &amp; Reporting
        </Link>
      </PublicInfoCard>

      <PublicInfoCard
        title="Competition responsibility"
        icon="tournament"
      >
        <p>
          League and Tournament administrators are responsible for the competition rules they publish, participant decisions they make and result corrections they approve through their authorized controls. Administrators must use those controls consistently and must not intentionally falsify standings, results or disciplinary records.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Results & evidence"
        icon="result"
      >
        <p>
          Players should submit accurate scores and genuine evidence. Do not alter screenshots or provide false evidence to misrepresent a match. FC ARENA&apos;s verification and dispute workflows support competition administration but do not replace the organizer&apos;s published competition rules.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="FC ARENA AI"
        icon="info"
      >
        <p>
          FC ARENA AI is a read-only assistant and may produce incorrect or unsuitable output. It must not be used to generate or request restricted, abusive, exploitative, deceptive or unlawful content.
        </p>

        <p>
          If an AI response is inappropriate or offensive, use the in-app report control shown with the response. Reported AI output may be reviewed to improve safety and moderation.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Account security"
        icon="lock"
      >
        <p>
          Users are responsible for protecting their account credentials and for activity performed through their authenticated account. Never share passwords or one-time passwords. Notify FC ARENA through available support or safety channels if you believe an account is being misused.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Enforcement"
        icon="shield"
      >
        <p>
          FC ARENA may restrict content, competition privileges or accounts when reasonably necessary to enforce these Terms, protect users, preserve competition integrity, respond to valid reports or comply with law. Repeated or serious violations may lead to account suspension or removal.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Service availability"
        icon="info"
      >
        <p>
          FC ARENA may evolve as features are added or improved. The application should not be used as the sole record of information that must be independently retained by an organizer. Features may be changed, limited or temporarily unavailable for maintenance, safety or operational reasons.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Privacy & account deletion"
        icon="document"
      >
        <p>
          Personal data is handled according to the FC ARENA Privacy Policy. You can request deletion of your account and associated personal data from inside the app or through the public account-deletion resource.
        </p>

        <div className="flex flex-wrap gap-4">
          <Link
            href="/privacy"
            className="theme-text-link font-semibold underline underline-offset-4"
          >
            Privacy Policy
          </Link>

          <Link
            href="/account-deletion"
            className="theme-text-link font-semibold underline underline-offset-4"
          >
            Delete Account &amp; Data
          </Link>
        </div>
      </PublicInfoCard>
    </PublicInfoPage>
  );
}
