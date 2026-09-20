import type { ReactNode } from 'react';

interface AuthCardProps {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthCard({
  eyebrow,
  title,
  description,
  children,
}: AuthCardProps) {
  return (
    <main className="auth-page auth-premium">
      <section className="auth-brand-panel">
        <div className="auth-brand-top">
          <div className="brand-mark" aria-hidden="true">
            <span className="brand-mark-crown">♛</span>
          </div>

          <div>
            <p className="auth-brand-name">
              FC <span>ARENA</span>
            </p>
            <p className="auth-brand-tagline">
              PLAY • COMPETE • BELONG
            </p>
          </div>
        </div>

        <div className="auth-brand-content">
          <p className="brand-kicker">FOOTBALL COMPETITION PLATFORM</p>

          <h1>
            Build your
            <span> football legacy.</span>
          </h1>

          <p className="brand-copy">
            Compete. Track every result. Climb the rankings.
            Build a permanent competitive history.
          </p>

          <div className="auth-feature-row" aria-label="FC ARENA features">
            <span>Live competitions</span>
            <span>Career tracking</span>
            <span>Verified results</span>
          </div>
        </div>

        <div className="auth-brand-footer">
          <span>FC ARENA</span>
          <span className="auth-live-dot" />
          <span>More than a game</span>
        </div>

        <div className="auth-stadium-glow" aria-hidden="true" />
        <div className="auth-pitch-lines" aria-hidden="true" />
        <div className="auth-floating-ball" aria-hidden="true">⚽</div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-form-orb auth-form-orb-one" aria-hidden="true" />
        <div className="auth-form-orb auth-form-orb-two" aria-hidden="true" />

        <div className="auth-card">
          <div className="auth-card-accent" aria-hidden="true" />

          <p className="auth-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-description">{description}</p>

          {children}

          <div className="auth-security-note">
            <span className="auth-security-icon" aria-hidden="true">✓</span>
            <span>Secure FC ARENA player access</span>
          </div>
        </div>
      </section>
    </main>
  );
}
