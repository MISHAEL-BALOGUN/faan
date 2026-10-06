import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';

// Local development and tests use the SQLite file from DATABASE_URL.
// When TURSO_DATABASE_URL is set (Vercel), the same schema is reached over
// libSQL instead, so the app keeps no database file of its own.
const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSQL({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN })
  : undefined;

export const prisma = adapter ? new PrismaClient({ adapter }) : new PrismaClient();
