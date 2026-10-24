import type {
  Metadata,
} from 'next';

import Link from 'next/link';

import { HomeSessionRedirect } from '@/components/auth/home-session-redirect';
import { FC_ARENA_LOGO_DATA_URI } from '@/lib/brand-assets';


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
    <>
      <HomeSessionRedirect />

      <main className="fc-public-home min-h-screen">
        <header className="fc-public-home-header mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-10">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="theme-brand-mark grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl border">
              <img src={FC_ARENA_LOGO_DATA_URI} alt="" className="h-full w-full object-cover" />
            </span>
            <span className="min-w-0">
              <span className="fc-display block text-lg font-bold tracking-[-0.03em] text-white">FC <span className="text-[#e5c77f]">ARENA</span></span>
              <span className="hidden text-[10px] font-semibold tracking-[0.16em] text-[#9fb1c2] sm:block">FOOTBALL ESPORTS</span>
            </span>
          </Link>

          <nav className="flex items-center gap-2" aria-label="Public navigation">
            <Link href="/login" className="theme-secondary-button premium-button">Sign In</Link>
            <Link href="/register" className="theme-primary-button premium-button">Create Account</Link>
          </nav>
        </header>

        <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 pb-12 pt-8 sm:px-8 sm:pb-20 sm:pt-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)] lg:items-center lg:px-10 lg:pt-16">
          <div className="fc-public-home-copy min-w-0">
            <p className="premium-eyebrow">THE MATCHDAY OPERATING SYSTEM</p>
            <h1 className="mt-4 max-w-4xl text-[clamp(40px,7vw,78px)] font-semibold leading-[0.98] tracking-[-0.06em] text-white">
              Your football world,
              <span className="block text-[#e5c77f]">built to compete.</span>
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-[#c4d0dd] sm:text-lg">
              Create leagues, run tournaments, follow real fixtures, confirm results, and build a player history that feels as serious as the competition.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/register" className="theme-primary-button premium-button">Enter the Arena <span aria-hidden="true">→</span></Link>
              <Link href="/about" className="theme-secondary-button premium-button">Explore FC ARENA</Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#9fb1c2]">
              <span>Leagues</span>
              <span>Tournaments</span>
              <span>Verified results</span>
              <span>Player career</span>
            </div>
          </div>

          <div className="fc-public-home-feature premium-home-next">
            <div className="premium-home-feature-art" aria-hidden="true" />
            <div className="relative z-10">
              <p className="premium-eyebrow">BUILT FOR MATCHDAY</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">Every fixture has a story.</h2>
              <p className="mt-4 text-sm leading-6 text-[#c4d0dd]">One focused home for your next opponent, your league context, your standings, and the moments that define your season.</p>

              <div className="mt-8 grid gap-3 sm:grid-cols-2">
                {[
                  ['01', 'Next opponent', 'Know what is coming next.'],
                  ['02', 'Live competition', 'Stay close to every result.'],
                  ['03', 'Verified records', 'Keep every win meaningful.'],
                  ['04', 'Player identity', 'Build your football history.'],
                ].map(([number, title, detail]) => (
                  <div key={number} className="fc-public-home-feature-row">
                    <span>{number}</span>
                    <div><strong>{title}</strong><small>{detail}</small></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-7xl gap-4 px-5 pb-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-4 lg:px-10">
          {[
            ['Leagues', 'Build a real community around your competition.'],
            ['Tournaments', 'Run round robin, knockout, Elite Cup and UCL Cup formats.'],
            ['Fixtures', 'Track opponents, kickoffs, statuses, results and match rooms.'],
            ['Career', 'Turn verified performances into a player story that lasts.'],
          ].map(([title, description]) => (
            <article key={title} className="fc-public-home-card">
              <p className="premium-eyebrow">FC ARENA</p>
              <h2>{title}</h2>
              <p>{description}</p>
            </article>
          ))}
        </section>

        <footer className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 border-t border-white/10 px-5 py-6 text-xs text-[#9fb1c2] sm:px-8 lg:px-10">
          <span>FC ARENA · PLAY · COMPETE · BELONG</span>
          <span>Football esports, organized properly.</span>
        </footer>
      </main>
    </>
  );
}
