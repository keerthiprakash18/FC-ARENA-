import type {
  ReactNode,
} from 'react';

import {
  FcIcon,
} from '@/components/fc/fc-icons';

import styles from './auth-experience.module.css';

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
    <main className={styles.experience}>
      <section
        className={styles.visualPanel}
        aria-label="FC ARENA football experience"
      >
        <div
          className={styles.stadiumGlow}
          aria-hidden="true"
        />

        <div
          className={styles.stadiumGlowSecondary}
          aria-hidden="true"
        />

        <div
          className={styles.floodlightLeft}
          aria-hidden="true"
        />

        <div
          className={styles.floodlightRight}
          aria-hidden="true"
        />

        <div
          className={styles.fog}
          aria-hidden="true"
        />

        <div className={styles.brandTop}>
          <div
            className={styles.logoBadge}
            aria-hidden="true"
          >
            <FcIcon
              name="football"
              size={27}
            />
          </div>

          <div>
            <p className={styles.brandName}>
              FC <span>ARENA</span>
            </p>

            <p className={styles.brandMini}>
              PLAY · COMPETE · BELONG
            </p>
          </div>
        </div>

        <div className={styles.hero}>
          <p className={styles.kicker}>
            FOOTBALL COMPETITION PLATFORM
          </p>

          <h1 className={styles.headline}>
            MORE THAN A GAME
          </h1>

          <p className={styles.subline}>
            PLAY · COMPETE · BELONG
          </p>

          <p className={styles.supportCopy}>
            Your competition. Your identity. Your arena.
          </p>
        </div>

        <div
          className={styles.ball}
          aria-hidden="true"
        >
          <FcIcon
            name="football"
            size={38}
          />
        </div>
      </section>

      <section className={styles.formPanel}>
        <div className={styles.card}>
          <p className={styles.eyebrow}>
            {eyebrow}
          </p>

          <h2 className={styles.title}>
            {title}
          </h2>

          <p className={styles.description}>
            {description}
          </p>

          {children}

          <div className={styles.securityNote}>
            <span
              className={styles.securityIcon}
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
