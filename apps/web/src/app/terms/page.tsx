import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

export default function TermsPage() {
  return (
    <PublicInfoPage
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms describe the basic rules for using FC ARENA as a player, League member, Tournament participant or administrator."
    >
      <PublicInfoCard
        title="Use of the platform"
        icon="shield"
      >
        <p>
          Use FC ARENA only for lawful football and esports competition activity. Do not attempt to access another user&apos;s account, bypass permissions or interfere with the service.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Competition responsibility"
        icon="tournament"
      >
        <p>
          League and Tournament administrators are responsible for the competition rules they publish, participant decisions they make and result corrections they approve through their authorized controls.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Results & evidence"
        icon="result"
      >
        <p>
          Players should submit accurate scores and evidence. FC ARENA&apos;s verification and dispute workflows support competition administration but do not replace the organizer&apos;s published rules.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Account security"
        icon="lock"
      >
        <p>
          Users are responsible for protecting their account credentials and for activity performed through their authenticated account.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Service availability"
        icon="info"
      >
        <p>
          FC ARENA may evolve as features are added or improved. The application should not be used as the sole record of information that must be independently retained by an organizer.
        </p>
      </PublicInfoCard>
    </PublicInfoPage>
  );
}
