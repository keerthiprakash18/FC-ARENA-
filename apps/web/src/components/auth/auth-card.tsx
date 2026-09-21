import type {
  ReactNode,
} from 'react';

import {
  FcIcon,
} from '@/components/fc/fc-icons';

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
          <div
            className="brand-mark"
            aria-hidden="true"
          >
            <FcIcon
              name="football"
              size={25}
            />
          </div>

          <div>
            <p className="auth-brand-name">
              FC <span>ARENA</span>
            </p>

            <p className="auth-brand-tagline">
              PLAY · COMPETE · BELONG
            </p>
          </div>
        </div>

        <div className="auth-brand-content">
          <p className="brand-kicker">
            FOOTBALL COMPETITION PLATFORM
          </p>

          <h1>
            Build your
            <span> football legacy.</span>
          </h1>

          <p className="brand-copy">
            Compete, verify results, follow fixtures and build a permanent competitive history.
          </p>

          <div
            className="auth-feature-row"
            aria-label="FC ARENA features"
          >
            <span>
              Live competitions
            </span>

            <span>
              Career tracking
            </span>

            <span>
              Verified results
            </span>
          </div>
        </div>

        <div className="auth-brand-footer">
          <span>
            FC ARENA
          </span>

          <span className="auth-live-dot" />

          <span>
            More than a game
          </span>
        </div>

        <div
          className="auth-pitch-lines"
          aria-hidden="true"
        />
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="auth-eyebrow">
            {eyebrow}
          </p>

          <h2>
            {title}
          </h2>

          <p className="auth-description">
            {description}
          </p>

          {children}

          <div className="auth-security-note">
            <span
              className="auth-security-icon"
              aria-hidden="true"
            >
              <FcIcon
                name="lock"
                size={13}
              />
            </span>

            <span>
              Secure FC ARENA player access
            </span>
          </div>
        </div>
      </section>
    </main>
  );
}
