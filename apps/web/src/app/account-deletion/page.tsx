import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

import {
  AccountDeletionForm,
} from './account-deletion-form';

export default function AccountDeletionPage() {
  return (
    <PublicInfoPage
      eyebrow="Privacy"
      title="Delete Your FC ARENA Account & Data"
      description="Use this public page to request deletion of your FC ARENA account and associated personal data. You do not need to be signed in to submit a request."
    >
      <PublicInfoCard
        title="What happens after you submit"
        icon="profile"
      >
        <p>
          We record your deletion request and may contact the email address you provide to verify that you control the FC ARENA account before deletion is completed.
        </p>

        <p>
          After verification, account credentials, profile information, player identity data, active sessions and other personal data associated with the account are deleted or anonymized as appropriate.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Competition records"
        icon="fixtures"
      >
        <p>
          Some competition records may need to remain in a de-identified or anonymized form where this is necessary to preserve completed Tournament results, standings, dispute history, security records or legal obligations. We do not use retained records to recreate a deleted account.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Before you submit"
        icon="shield"
      >
        <p>
          Enter the email address used for your FC ARENA account. Your In-Game Name is optional but can help us locate the correct account. Never send us your password or OTP.
        </p>
      </PublicInfoCard>

      <AccountDeletionForm />
    </PublicInfoPage>
  );
}
