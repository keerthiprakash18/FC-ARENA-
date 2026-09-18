import {
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

const ocrSource =
  readTypescriptTree(
    currentDirectory,
  );

describe(
  'FC ARENA OCR safety',
  () => {
    it(
      'supports JPG JPEG PNG and WEBP images',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /(jpeg|jpg)/i,
        );

        expect(
          ocrSource,
        ).toMatch(
          /png/i,
        );

        expect(
          ocrSource,
        ).toMatch(
          /webp/i,
        );
      },
    );

    it(
      'contains a 10 MB upload limit',
      () => {
        const normalized =
          ocrSource.replace(
            /\s+/g,
            '',
          );

        const hasBytesLimit =
          /10\*1024\*1024/.test(
            normalized,
          );

        const hasLiteralLimit =
          /(10485760|10MB|10mb)/.test(
            normalized,
          );

        expect(
          hasBytesLimit ||
          hasLiteralLimit,
        ).toBe(
          true,
        );
      },
    );

    it(
      'validates image metadata with sharp',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /sharp/i,
        );

        expect(
          ocrSource,
        ).toMatch(
          /metadata/i,
        );
      },
    );

    it(
      'contains minimum image resolution protection',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /320/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /240/,
        );
      },
    );

    it(
      'contains maximum image resolution protection',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /8000/,
        );
      },
    );

    it(
      'uses background queue processing',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /(BullMQ|InjectQueue|Queue<|\.add\()/,
        );
      },
    );

    it(
      'uses Tesseract through the OCR provider layer',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /(tesseract|createWorker)/i,
        );
      },
    );

    it(
      'restricts identity matching to current match participants',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /homeRegistration/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /awayRegistration/,
        );
      },
    );

    it(
      'contains fuzzy name matching',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /(levenshtein|distance|similarity)/i,
        );
      },
    );

    it(
      'normalizes confidence values to the 0 to 1 range',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /Math\.max\s*\(/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /Math\.min\s*\(\s*1/,
        );
      },
    );

    it(
      'does not trust participant matching below 0.5 confidence',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /best\.confidence\s*<\s*0\.5/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /userId\s*:\s*null/,
        );
      },
    );

    it(
      'creates OCR result submission requiring human verification',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /PENDING_VERIFICATION/,
        );
      },
    );

    it(
      'does not automatically confirm OCR result submissions',
      () => {
        const suspicious =
          /status\s*:\s*['"]CONFIRMED['"]/g;

        expect(
          ocrSource.match(
            suspicious,
          ) ?? [],
        ).toHaveLength(
          0,
        );
      },
    );

    it(
      'persists OCR extraction lifecycle state',
      () => {
        expect(
          ocrSource,
        ).toMatch(
          /ocrExtraction/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /QUEUED/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /PROCESSING/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /COMPLETED/,
        );

        expect(
          ocrSource,
        ).toMatch(
          /FAILED/,
        );
      },
    );
  },
);