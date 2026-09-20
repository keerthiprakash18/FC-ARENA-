import type {
  Metadata,
} from 'next';

import Link from 'next/link';


export const metadata: Metadata = {
  title:
    'FC ARENA | Football Tournament & League Management',

  description:
    'FC ARENA is a football esports community platform for leagues, tournaments, fixtures, standings and competitive match management.',

  alternates: {
    canonical:
      'https://fcarena.in',
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      'max-image-preview':
        'large',
      'max-snippet':
        -1,
      'max-video-preview':
        -1,
    },
  },

  openGraph: {
    type: 'website',
    url:
      'https://fcarena.in',
    siteName:
      'FC ARENA',
    title:
      'FC ARENA | Football Tournament & League Management',
    description:
      'FC ARENA is a football esports community platform for leagues, tournaments, fixtures, standings and competitive match management.',
  },
};


export default function Home() {
  return (
    <main className="min-h-screen bg-[#071019] text-[#F8FAFC]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-6 py-16 sm:px-8 lg:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#19B7FF]">
          FC ARENA
        </p>

        <h1 className="mt-5 max-w-4xl text-4xl font-bold tracking-[-0.04em] sm:text-5xl lg:text-7xl">
          Football leagues,
          tournaments and match
          management in one place.
        </h1>

        <p className="mt-6 max-w-2xl text-base leading-7 text-[#A7B0BE] sm:text-lg">
          FC ARENA is a football esports community platform for leagues,
          tournaments, fixtures, standings and competitive match management.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/login"
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#19B7FF] px-6 text-sm font-semibold text-[#071019] transition hover:bg-[#21C3FF]"
          >
            Sign In
          </Link>

          <Link
            href="/register"
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-[#284154] bg-[#101923] px-6 text-sm font-semibold text-[#F8FAFC] transition hover:border-[#19B7FF]/35 hover:bg-[#14212D]"
          >
            Create Account
          </Link>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            [
              'Leagues',
              'Build and manage football communities.',
            ],
            [
              'Tournaments',
              'Run structured competitive formats.',
            ],
            [
              'Fixtures',
              'Track schedules, results and match status.',
            ],
            [
              'Standings',
              'Keep competitive records organized.',
            ],
          ].map(
            ([
              title,
              description,
            ]) => (
              <article
                key={
                  title
                }
                className="rounded-2xl border border-[#203141] bg-[#101923] p-5"
              >
                <h2 className="text-base font-semibold">
                  {
                    title
                  }
                </h2>

                <p className="mt-2 text-sm leading-6 text-[#6F7B8A]">
                  {
                    description
                  }
                </p>
              </article>
            ),
          )}
        </div>
      </section>
    </main>
  );
}
