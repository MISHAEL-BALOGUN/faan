import 'dotenv/config';
import app, { prisma } from './app.js';

const port = Number(process.env.PORT || 4000);
if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET must be set in production.');
await prisma.$connect();
await prisma.$executeRawUnsafe('PRAGMA foreign_keys = ON');
const server = app.listen(port, () => console.log(`FAAN ICT API listening on http://localhost:${port}`));

async function shutdown() {
  server.close();
  await prisma.$disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
