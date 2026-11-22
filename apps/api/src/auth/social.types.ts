export type SocialProvider = 'google' | 'facebook';
export interface VerifiedSocialIdentity {
  provider: SocialProvider;
  subject: string;
  email: string | null;
  emailVerified: boolean;
  fullName: string;
}
