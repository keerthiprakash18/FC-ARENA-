import pg from 'pg';

const {
  Client,
} = pg;

const REQUIRED_CONFIRMATION =
  'RESET_ALL_FC_ARENA_TEST_DATA';

const confirmation =
  process.env.FC_ARENA_RESET_CONFIRM;

if (
  confirmation !==
  REQUIRED_CONFIRMATION
) {
  console.error(
    'Refusing to reset the database.',
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

const client =
  new Client({
    connectionString:
      databaseUrl,
  });

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

try {
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

    process.exitCode =
      0;
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
      `Reset complete. Cleared ${tables.rows.length} application table(s); Prisma migration history was preserved.`,
    );
  }
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
    'FC ARENA test database reset failed:',
    error,
  );

  process.exitCode =
    1;
} finally {
  await client.end();
}
