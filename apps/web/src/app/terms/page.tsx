import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

export default function TermsPage() {
  return (
    <PublicInfoPage
      eyebrow="Legal"
      title="Terms of Service"
      description="These terms describe the rules for using FC ARENA as a player, League member, Tournament participant or administrator."
    >
      <PublicInfoCard
        title="Use of the platform"
        icon="shield"
      >
        <p>
          Use FC ARENA only for lawful football and esports competition activity. Do not attempt to access another user&apos;s account, bypass permissions, interfere with the service, automate abusive traffic or misuse another player&apos;s personal information.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Community content rules"
        icon="profile"
      >
        <p>
          Content you submit to FC ARENA, including profile identity, team or Tournament names, images, result evidence, reports, disputes, Fair Play reasons and appeals, must be lawful and appropriate for the FC ARENA community.
        </p>

        <p>
          Do not submit harassment or bullying, hate or abusive content, sexual or exploitative content, graphic violence, scams or spam, impersonation, illegal content, malicious links, or content that infringes another person&apos;s privacy, copyright, trademark or other rights.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Reporting, blocking & moderation"
        icon="shield"
      >
        <p>
          FC ARENA provides reporting and blocking controls for supported community interactions. Reports are reviewed as moderation signals and do not automatically prove a violation or automatically punish a player.
        </p>

        <p>
          FC ARENA may remove or restrict violating content, resolve or dismiss reports, restrict abusive accounts, or take other proportionate action needed to protect users, competition integrity and platform security. Competition records may remain in de-identified form where they are needed to preserve completed results and audit integrity.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Competition responsibility"
        icon="tournament"
      >
        <p>
          League and Tournament administrators are responsible for the competition rules they publish, participant decisions they make and result corrections they approve through their authorized controls. Administrative powers must not be used to harass, discriminate against or fraudulently disadvantage participants.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Results & evidence"
        icon="result"
      >
        <p>
          Players should submit accurate scores and evidence. Do not fabricate results or knowingly submit misleading evidence. FC ARENA&apos;s verification and dispute workflows support competition administration but do not replace the organizer&apos;s published rules.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Intellectual property"
        icon="document"
      >
        <p>
          Only upload or publish logos, images, names, text or other material that you are allowed to use. FC ARENA does not grant permission to use third-party game, club, league, film or brand assets merely because the platform allows a text name or image upload.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Account security"
        icon="lock"
      >
        <p>
          Users are responsible for protecting their account credentials and for activity performed through their authenticated account. Do not share passwords or one-time passwords, and report suspected account compromise promptly.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Account restriction & deletion"
        icon="profile"
      >
        <p>
          FC ARENA may restrict access where reasonably necessary for security, abuse prevention, repeated Terms violations or legal compliance. Users can request account and associated personal-data deletion through the in-app and public deletion flows described in the Privacy Policy.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Service availability"
        icon="info"
      >
        <p>
          FC ARENA may evolve as features are added or improved. The application should not be used as the sole record of information that must be independently retained by an organizer. Features may be temporarily unavailable during maintenance, incident response or security work.
        </p>
      </PublicInfoCard>
    </PublicInfoPage>
  );
}
