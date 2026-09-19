import {
  redirect,
} from 'next/navigation';

export default function LegacyFixtureGeneratorPage() {
  redirect(
    '/fixtures/generate',
  );
}
