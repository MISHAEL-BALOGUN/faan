import 'dotenv/config';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@libsql/client';

// Applies the checked-in Prisma migrations to a remote libSQL database.
// Prisma Migrate only speaks to a local SQLite file, so this script is how the
// same schema reaches Turso. It records what it has run and skips it next time.
const url = process.env.TURSO_DATABASE_URL;
if (!url) {
  console.error('TURSO_DATABASE_URL is not set. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first.');
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');

async function main() {
  await client.execute('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)');
  const applied = new Set((await client.execute('SELECT name FROM _migrations')).rows.map(row => String(row.name)));
  const folders = readdirSync(migrationsDir, { withFileTypes: true })
    .filter(entry => entry.isDirectory()).map(entry => entry.name).sort();

  let run = 0;
  for (const folder of folders) {
    if (applied.has(folder)) continue;
    const sql = readFileSync(join(migrationsDir, folder, 'migration.sql'), 'utf8');
    await client.executeMultiple(sql);
    await client.execute({ sql: 'INSERT INTO _migrations (name) VALUES (?)', args: [folder] });
    console.log(`Applied ${folder}`);
    run += 1;
  }

  console.log(run ? `Applied ${run} migration(s) to ${url}` : `Schema already up to date on ${url}`);
}

main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => client.close());
