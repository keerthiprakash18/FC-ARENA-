import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      eyebrow="Legal"
      title="Privacy Policy"
      description="This page summarizes the data FC ARENA currently uses to provide account and competition features."
    >
      <PublicInfoCard
        title="Account & player data"
        icon="profile"
      >
        <p>
          FC ARENA uses authenticated account information and player identity data to provide sign-in, profiles and competition participation.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Competition records"
        icon="fixtures"
      >
        <p>
          League memberships, Tournament entries, fixtures, standings, match results, career statistics, achievements and related admin actions are used to operate the competition features visible in the app.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Uploaded match evidence"
        icon="document"
      >
        <p>
          When a user submits screenshots or other evidence for result verification, FC ARENA may process that material through the existing OCR and result-verification workflow.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Public Tournament visibility"
        icon="shield"
      >
        <p>
          A Tournament configured as public can expose the Tournament information provided by the public Tournament endpoint, such as fixtures, standings and competition participants. Private or League-only competitions are not made public by this page.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Current privacy controls"
        icon="settings"
      >
        <p>
          The current backend does not expose a separate privacy-preferences panel or a self-service data deletion control. FC ARENA does not present non-functional privacy toggles.
        </p>
      </PublicInfoCard>
    </PublicInfoPage>
  );
}
