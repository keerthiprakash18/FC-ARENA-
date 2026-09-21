import pg from 'pg';
import {
  Queue,
} from 'bullmq';

const {
  Client,
} = pg;

const REQUIRED_CONFIRMATION =
  'RESET_ALL_FC_ARENA_TEST_DATA';

const OCR_QUEUE_NAME =
  'match-result-ocr';

const OCR_IDLE_TIMEOUT_MS =
  30_000;

const confirmation =
  process.env.FC_ARENA_RESET_CONFIRM;

if (
  confirmation !==
  REQUIRED_CONFIRMATION
) {
  console.error(
    'Refusing to reset FC ARENA test state.',
  );

  console.error(
    `Set FC_ARENA_RESET_CONFIRM=${REQUIRED_CONFIRMATION} for this one command only.`,
  );

  process.exit(
    1,
  );
}

const databaseUrl =
  process.env.DATABASE_URL;

if (
  !databaseUrl
) {
  console.error(
    'DATABASE_URL is required.',
  );

  process.exit(
    1,
  );
}

function quoteIdentifier(
  value,
) {
  return `"${String(
    value,
  ).replaceAll(
    '"',
    '""',
  )}"`;
}

function redisConnectionFromEnvironment() {
  const redisUrl =
    process.env.REDIS_URL;

  if (redisUrl) {
    const url =
      new URL(
        redisUrl,
      );

    return {
      host:
        url.hostname,

      port:
        Number(
          url.port ||
            6379,
        ),

      username:
        url.username
          ? decodeURIComponent(
              url.username,
            )
          : undefined,

      password:
        url.password
          ? decodeURIComponent(
              url.password,
            )
          : undefined,

      family:
        0,
    };
  }

  if (
    !process.env.REDIS_HOST
  ) {
    return null;
  }

  return {
    host:
      process.env.REDIS_HOST,

    port:
      Number(
        process.env.REDIS_PORT ??
          6379,
      ),

    username:
      process.env.REDIS_USERNAME ||
      undefined,

    password:
      process.env.REDIS_PASSWORD ||
      undefined,

    family:
      0,
  };
}

async function waitForQueueToBecomeIdle(
  queue,
) {
  const deadline =
    Date.now() +
    OCR_IDLE_TIMEOUT_MS;

  while (
    Date.now() <
    deadline
  ) {
    const activeCount =
      await queue.getActiveCount();

    if (
      activeCount ===
      0
    ) {
      return;
    }

    console.log(
      `Waiting for ${activeCount} active OCR job(s) to finish before reset...`,
    );

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          1_000,
        ),
    );
  }

  const activeCount =
    await queue.getActiveCount();

  if (
    activeCount >
    0
  ) {
    throw new Error(
      `Refusing to reset while ${activeCount} OCR job(s) are still active.`,
    );
  }
}

async function prepareOcrQueueForReset() {
  const connection =
    redisConnectionFromEnvironment();

  if (
    !connection
  ) {
    console.log(
      'Redis is not configured for this environment; skipping OCR queue cleanup.',
    );

    return null;
  }

  const queue =
    new Queue(
      OCR_QUEUE_NAME,
      {
        connection,
      },
    );

  await queue.pause();

  console.log(
    'Paused FC ARENA OCR queue.',
  );

  await waitForQueueToBecomeIdle(
    queue,
  );

  await queue.drain(
    true,
  );

  console.log(
    'Drained waiting/delayed OCR jobs.',
  );

  return queue;
}

const client =
  new Client({
    connectionString:
      databaseUrl,
  });

let ocrQueue =
  null;

let resetSucceeded =
  false;

try {
  ocrQueue =
    await prepareOcrQueueForReset();

  await client.connect();

  const database =
    await client.query(
      'SELECT current_database() AS name, current_schema() AS schema',
    );

  const target =
    database.rows[0];

  console.log(
    `FC ARENA test reset target: database=${target?.name ?? 'unknown'} schema=${target?.schema ?? 'unknown'}`,
  );

  const tables =
    await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
        AND tablename <> '_prisma_migrations'
      ORDER BY tablename
    `);

  if (
    tables.rows.length ===
    0
  ) {
    console.log(
      'No FC ARENA application tables found to reset.',
    );
  } else {
    const tableList =
      tables.rows
        .map(
          ({
            tablename,
          }) =>
            quoteIdentifier(
              tablename,
            ),
        )
        .join(
          ', ',
        );

    await client.query(
      'BEGIN',
    );

    await client.query(
      `TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`,
    );

    await client.query(
      'COMMIT',
    );

    console.log(
      `Database reset complete. Cleared ${tables.rows.length} application table(s); Prisma migration history was preserved.`,
    );
  }

  if (
    ocrQueue
  ) {
    await ocrQueue.obliterate({
      force:
        true,
    });

    console.log(
      'OCR queue reset complete.',
    );
  }

  resetSucceeded =
    true;

  console.log(
    'FC ARENA fresh-testing state reset completed successfully.',
  );
} catch (
  error
) {
  await client.query(
    'ROLLBACK',
  ).catch(
    () =>
      undefined,
  );

  console.error(
    'FC ARENA test-state reset failed:',
    error,
  );

  process.exitCode =
    1;
} finally {
  if (
    ocrQueue
  ) {
    if (
      !resetSucceeded
    ) {
      await ocrQueue.resume()
        .catch(
          () =>
            undefined,
        );
    }

    await ocrQueue.close()
      .catch(
        () =>
          undefined,
      );
  }

  await client.end()
    .catch(
      () =>
        undefined,
    );
}
