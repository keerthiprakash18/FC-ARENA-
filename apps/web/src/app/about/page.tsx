import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

export default function AboutPage() {
  return (
    <PublicInfoPage
      eyebrow="FC ARENA"
      title="About FC ARENA"
      description="A football competition platform built around real leagues, tournaments, fixtures, verified results and player history."
    >
      <PublicInfoCard
        title="Competition first"
        icon="tournament"
      >
        <p>
          FC ARENA organizes League membership, Tournament setup, fixture generation, standings, knockout progression and verified match results in one connected competition workflow.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Player identity"
        icon="profile"
      >
        <p>
          Authenticated player profiles use the real account, League and competition data already stored by FC ARENA. The interface does not populate fabricated players, teams or statistics.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Product version"
        icon="info"
      >
        <p>
          FC ARENA v1.0.0 · More Than A Game.
        </p>
      </PublicInfoCard>
    </PublicInfoPage>
  );
}
