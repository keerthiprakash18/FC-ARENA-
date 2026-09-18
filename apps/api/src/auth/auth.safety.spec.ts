import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from 'node:fs';

import {
  dirname,
  join,
} from 'node:path';

import {
  fileURLToPath,
} from 'node:url';

import {
  describe,
  expect,
  it,
} from 'vitest';

function readTypescriptTree(
  directory: string,
): string {
  let output = '';

  for (
    const entry
    of readdirSync(directory)
  ) {
    const fullPath =
      join(
        directory,
        entry,
      );

    const stat =
      statSync(fullPath);

    if (
      stat.isDirectory()
    ) {
      output +=
        readTypescriptTree(
          fullPath,
        );

      continue;
    }

    if (
      !entry.endsWith('.ts') ||
      entry.endsWith('.spec.ts')
    ) {
      continue;
    }

    output +=
      '\n' +
      readFileSync(
        fullPath,
        'utf8',
      );
  }

  return output;
}

const currentDirectory =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const authSource =
  readTypescriptTree(
    currentDirectory,
  );

describe(
  'FC ARENA authentication safety',
  () => {
    it(
      'contains registration flow',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(register|registration)/i,
        );
      },
    );

    it(
      'contains OTP verification',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(verifyOtp|verify.*otp|OTP)/i,
        );
      },
    );

    it(
      'contains OTP expiration handling',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(expiresAt|expiry|expired|expiration)/i,
        );
      },
    );

    it(
      'contains OTP attempt protection',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(attempt|attempts|maxOtp|MAX_OTP)/i,
        );
      },
    );

    it(
      'uses password hashing',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(bcrypt|hashPassword|passwordHash)/i,
        );
      },
    );

    it(
      'contains password comparison during authentication',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(compare|verifyPassword)/i,
        );
      },
    );

    it(
      'contains access token generation',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(accessToken|access_token)/,
        );

        expect(
          authSource,
        ).toMatch(
          /(JwtService|jwt\.|signAsync|sign\()/,
        );
      },
    );

    it(
      'contains refresh token handling',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(refreshToken|refresh_token)/,
        );
      },
    );

    it(
      'protects refresh cookie as httpOnly',
      () => {
        expect(
          authSource,
        ).toMatch(
          /httpOnly\s*:\s*true/,
        );
      },
    );

    it(
      'contains logout flow',
      () => {
        expect(
          authSource,
        ).toMatch(
          /logout/i,
        );
      },
    );

    it(
      'contains forgot/reset password flow',
      () => {
        expect(
          authSource,
        ).toMatch(
          /(forgotPassword|forgot.*password)/i,
        );

        expect(
          authSource,
        ).toMatch(
          /(resetPassword|reset.*password)/i,
        );
      },
    );

    it(
      'does not store plaintext password using obvious direct assignment',
      () => {
        expect(
          authSource,
        ).not.toMatch(
          /passwordHash\s*:\s*dto\.password\b/,
        );
      },
    );

    it(
      'auth source exists and is non-trivial',
      () => {
        expect(
          existsSync(
            currentDirectory,
          ),
        ).toBe(
          true,
        );

        expect(
          authSource.length,
        ).toBeGreaterThan(
          1000,
        );
      },
    );
  },
);