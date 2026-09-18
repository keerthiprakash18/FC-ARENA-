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
    <main className="auth-page">
      <section className="auth-brand-panel">
        <div className="brand-mark">FCA</div>

        <div>
          <p className="brand-kicker">FC ARENA</p>
          <h1>Build your football legacy.</h1>
          <p className="brand-copy">
            Compete. Track every result. Climb the rankings. Build a
            permanent competitive history.
          </p>
        </div>

        <div className="stadium-lines" />
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="auth-eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-description">{description}</p>
          {children}
        </div>
      </section>
    </main>
  );
}