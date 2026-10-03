import Link from 'next/link';

import {
  PublicInfoCard,
  PublicInfoPage,
} from '@/components/fc/public-info-page';

export default function PrivacyPage() {
  return (
    <PublicInfoPage
      eyebrow="Legal"
      title="FC ARENA Privacy Policy"
      description="This Privacy Policy explains how FC ARENA collects, uses, stores, shares and protects information when you use the FC ARENA website and Android app."
    >
      <PublicInfoCard
        title="Who operates FC ARENA"
        icon="info"
      >
        <p>
          FC ARENA is the operator of the FC ARENA football esports Tournament management service available at fcarena.in and through the FC ARENA Android app.
        </p>

        <p>
          Effective date: 3 October 2026.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Information we collect"
        icon="profile"
      >
        <p>
          Account data can include your full name, email address, optional phone number, password hash, account status, verification status and app preferences.
        </p>

        <p>
          Player data can include your FC ARENA player code, In-Game Name, optional game UID, profile image and player verification information.
        </p>

        <p>
          Competition data can include League memberships and roles, Tournament registrations, teams, fixtures, match results, standings, statistics, achievements, disputes, notifications and administrative actions.
        </p>

        <p>
          Community safety data can include reports you submit, the reported player or content category, optional report details, block and unblock actions, and moderation outcomes. Fair Play data can include League-admin-issued conduct events, fixed policy point changes, reasons, optional evidence links, expiry or revocation details, and player appeals and appeal outcomes. We use this information to support transparent competition conduct, appeals, abuse prevention and community safety.
        </p>

        <p>
          If you voluntarily upload a profile photo or match/result evidence, we process those files to provide profile, OCR, verification and dispute features.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Authentication, security & device-related data"
        icon="shield"
      >
        <p>
          FC ARENA processes authentication and security information such as password hashes, password-reset or verification OTP records, refresh-session records, timestamps and security/rate-limit identifiers derived from requests. These are used to protect accounts, prevent abuse and keep sessions secure.
        </p>

        <p>
          OTPs are time-limited, and refresh sessions have a limited lifetime. We may also retain ordinary server and security logs for troubleshooting, fraud prevention, abuse prevention and service reliability.
        </p>

        <p>
          The Android app uses Firebase Crashlytics for production diagnostics. If the Android app crashes, becomes unresponsive or encounters a non-fatal application error, limited technical diagnostic information such as app version, device and operating-system information, crash stack traces and related runtime data can be processed to identify and fix reliability problems. FC ARENA does not enable Google Analytics in the Android app for this crash-reporting integration.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="How we use information"
        icon="settings"
      >
        <p>
          We use information to create and secure accounts, provide sign-in and password recovery, display player profiles, operate Leagues and Tournaments, generate fixtures, verify results, calculate standings and statistics, deliver notifications, resolve disputes, provide support and improve service reliability and security.
        </p>

        <p>
          We do not sell personal information, and the current FC ARENA app does not use advertising SDKs for targeted advertising.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Service providers"
        icon="document"
      >
        <p>
          FC ARENA uses service providers only where needed to operate the service. Current providers can include Vercel and Railway for application hosting and infrastructure, Brevo for transactional email delivery, Cloudinary for player profile and match-evidence image storage and delivery, Google Firebase Cloud Messaging for Android push-notification delivery, and Google Firebase Crashlytics for Android crash and reliability diagnostics.
        </p>

        <p>
          For Android push notifications, FC ARENA can process a Firebase Cloud Messaging registration token and limited notification-delivery metadata so that competition reminders and account activity can be delivered to your device. Notification permission is optional and can be disabled through Android settings.
        </p>

        <p>
          If the optional FC ARENA AI provider is enabled, the text you send to FC ARENA AI together with limited relevant account, League, Tournament, fixture and statistics context may be sent to the configured AI provider to generate a read-only response. FC ARENA AI is not authorized to change your FC ARENA records.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Public and community visibility"
        icon="fixtures"
      >
        <p>
          Your In-Game Name, FC ARENA player identity and competition activity may be visible to other League or Tournament participants where necessary for competition features.
        </p>

        <p>
          Tournaments configured as public may expose public competition information such as Tournament names, fixtures, standings and participant display identities. Ordinary member email addresses and private game UID values are not intended to be exposed through public Tournament views.
        </p>

        <p>
          Signed-in members may see a limited Fair Play summary on player profiles, such as the current score and status. Detailed Fair Play reasons, evidence, event history and appeal information are not exposed through public player profiles. Reports and disputes do not automatically reduce a Fair Play score.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Community safety & moderation"
        icon="shield"
      >
        <p>
          Signed-in users can report inappropriate player profiles or community content and can block other players from new League-owner membership interactions. FC ARENA Super Admin moderation can review submitted reports and record resolution outcomes. League Admins can issue Fair Play events only for members of Leagues they administer, using FC ARENA's fixed event policy; affected players can review their event history and submit an appeal, and authorized admins can record the appeal outcome or revoke an event.
        </p>

        <p>
          Blocking does not erase official fixtures, results, standings or other competition records that are needed to preserve competitive integrity.
        </p>

        <Link
          href="/safety"
          className="theme-text-link font-semibold underline underline-offset-4"
        >
          Open Safety &amp; Reporting
        </Link>
      </PublicInfoCard>

      <PublicInfoCard
        title="Data retention"
        icon="document"
      >
        <p>
          We keep account and competition data for as long as needed to provide FC ARENA, maintain account security, operate active competitions, resolve disputes and meet legitimate legal or security obligations.
        </p>

        <p>
          When a verified account deletion request is completed, account credentials, profile information, player identity information, active sessions and other personal data associated with that account are deleted or anonymized as appropriate.
        </p>

        <p>
          Some completed competition, audit, dispute, Fair Play moderation or security records may be retained in a de-identified or anonymized form where necessary to preserve competition integrity, prevent abuse or satisfy legal obligations. Retained records are not used to recreate a deleted account.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Account & data deletion"
        icon="profile"
      >
        <p>
          You can request deletion from inside FC ARENA through Settings or More → Delete Account &amp; Data. You can also submit a request without signing in using our public account deletion page.
        </p>

        <p>
          We may contact the account email address to verify ownership before completing deletion. Do not send your password or OTP as part of a deletion request.
        </p>

        <Link
          href="/account-deletion"
          className="theme-text-link font-semibold underline underline-offset-4"
        >
          Request account &amp; data deletion
        </Link>
      </PublicInfoCard>

      <PublicInfoCard
        title="Your choices"
        icon="settings"
      >
        <p>
          You can update certain profile information in the app, remove your profile photo, sign out of active sessions and request account deletion. You can choose not to provide optional data such as a phone number, game UID or profile image where the app allows it.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Security"
        icon="shield"
      >
        <p>
          We use measures such as password hashing, short-lived access tokens, protected refresh cookies, session revocation, rate limiting, HTTPS, input validation and restricted authorization checks to reduce unauthorized access and abuse. No online service can guarantee absolute security.
        </p>
      </PublicInfoCard>

      <PublicInfoCard
        title="Policy updates & contact"
        icon="info"
      >
        <p>
          We may update this policy when FC ARENA features or data practices change. The current version will remain publicly available on this page with its effective date.
        </p>

        <p>
          For privacy questions or account deletion requests, use the public account deletion resource below as FC ARENA&apos;s public privacy contact mechanism. It is available without a login. Do not include passwords, OTPs or other secret credentials.
        </p>

        <Link
          href="/account-deletion"
          className="theme-text-link font-semibold underline underline-offset-4"
        >
          FC ARENA privacy &amp; account deletion request
        </Link>
      </PublicInfoCard>
    </PublicInfoPage>
  );
}
