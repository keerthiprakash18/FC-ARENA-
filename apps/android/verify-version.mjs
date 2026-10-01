import {
  readFile,
} from 'node:fs/promises';

import {
  fileURLToPath,
} from 'node:url';

import {
  dirname,
  resolve,
} from 'node:path';

const here =
  dirname(
    fileURLToPath(
      import.meta.url,
    ),
  );

const propertiesPath =
  resolve(
    here,
    'version.properties',
  );

const gradlePath =
  resolve(
    here,
    'app',
    'build.gradle',
  );

const signingPath =
  resolve(
    here,
    'build-signed-release.ps1',
  );

const [
  propertiesText,
  gradleText,
  signingText,
] =
  await Promise.all([
    readFile(
      propertiesPath,
      'utf8',
    ),
    readFile(
      gradlePath,
      'utf8',
    ),
    readFile(
      signingPath,
      'utf8',
    ),
  ]);

const values =
  new Map();

for (
  const rawLine
  of propertiesText.split(
    /\r?\n/,
  )
) {
  const line =
    rawLine.trim();

  if (
    !line ||
    line.startsWith(
      '#',
    )
  ) {
    continue;
  }

  const separator =
    line.indexOf(
      '=',
    );

  if (
    separator <
    1
  ) {
    throw new Error(
      `Invalid version.properties line: ${rawLine}`,
    );
  }

  values.set(
    line
      .slice(
        0,
        separator,
      )
      .trim(),
    line
      .slice(
        separator +
          1,
      )
      .trim(),
  );
}

const versionCode =
  Number(
    values.get(
      'VERSION_CODE',
    ),
  );

const versionName =
  values.get(
    'VERSION_NAME',
  );

if (
  !Number.isInteger(
    versionCode,
  ) ||
  versionCode <
    1
) {
  throw new Error(
    'VERSION_CODE must be a positive integer.',
  );
}

if (
  typeof versionName !==
    'string' ||
  !/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(
    versionName,
  )
) {
  throw new Error(
    'VERSION_NAME must use semantic version format, for example 1.0.8.',
  );
}

if (
  !gradleText.includes(
    'version.properties',
  ) ||
  !gradleText.includes(
    'fcVersionCode',
  ) ||
  !gradleText.includes(
    'fcVersionName',
  )
) {
  throw new Error(
    'Android build.gradle must read package version from version.properties.',
  );
}

if (
  /versionCode\s+\d+/.test(
    gradleText,
  ) ||
  /versionName\s+['"]\d/.test(
    gradleText,
  )
) {
  throw new Error(
    'Do not hardcode Android versionCode/versionName in app/build.gradle.',
  );
}

if (
  !signingText.includes(
    'version.properties',
  )
) {
  throw new Error(
    'Signed release helper must read version.properties.',
  );
}

console.log(
  `FC Arena Android version verified: ${versionName} (build ${versionCode})`,
);
