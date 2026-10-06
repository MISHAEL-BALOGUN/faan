# FAAN ICT Equipment and Maintenance Management System

A proposed student project and demonstration for registering ICT equipment, reporting faults, assigning technicians, and retaining maintenance history. This is not an officially approved FAAN system. All included names, contact details, assets, and work records are fictional demonstration data.

## Technology

- React, TypeScript, Vite, and Tailwind CSS
- Express and TypeScript API
- SQLite database on the backend with Prisma ORM
- bcrypt password hashing, signed HTTP-only session cookies, CSRF token checks, and server-side role checks

## Requirements

Node.js 20 or later and npm. Use one persistent server disk for the SQLite database. Do not run multiple app instances with separate local database files; they would have independent records. If scaling to multiple instances, move to a shared database service rather than copying SQLite files between instances.

## Setup

```powershell
npm install
Copy-Item .env.example server/.env
```

Replace `SESSION_SECRET` in `server/.env` with a randomly generated secret (at least 32 random characters). The database URL in the example resolves to `server/prisma/faan.db`, beside the Prisma schema.

Create the local SQLite database from the checked-in migration, then load fictional demo data:

```powershell
npm run db:deploy
npm run db:seed
```

For schema development, `npm run db:migrate` creates and applies a Prisma migration. After changing the Prisma schema, review and commit the generated migration.

## Run and build

```powershell
npm run dev
npm run build
npm test
```

Vite runs at `http://localhost:5173` and proxies `/api` requests to the Express API on port `4000`.
For a production build, run `npm run build`, apply the database migration and seed as needed, then run `npm start`; Express serves the built frontend and API from the same origin.

## Demonstration logins

- Administrator: `admin.demo@example.test` / `DemoAdmin!2026`
- Technician: `technician.demo@example.test` / `DemoTech!2026`

Change or remove the seeded demonstration accounts before deployment. Public registration is not available. Administrators create additional accounts from User Management.

## Main workflow

1. Sign in as the administrator and create a staff directory entry and equipment record.
2. Submit a fault report for the equipment and assign an active technician account.
3. Sign in as the assigned technician, record maintenance work, then move the fault to Under repair if needed.
4. Resolve the fault with a required resolution summary. The resolution timestamp is recorded automatically.
5. Confirm dashboard counts, equipment condition/history, and printable or CSV reports.

An equipment record with fault history is retired instead of deleted. Equipment returns to Operational after its last unresolved fault is resolved; other open faults prevent that transition.

## Database relationships

- A staff directory record may be assigned to multiple equipment records; deleting a staff record clears those assignments.
- Equipment has many fault reports. Fault reports link to their equipment, reporting user, and optional assigned technician.
- Fault reports have many maintenance records. Each maintenance record links to the technician responsible for that work.
- Login users and staff directory entries are separate concepts. Foreign keys restrict deletion of users and equipment that are still referenced by history.
- Indexes support unique email/staff/asset/fault references and common equipment, fault, status, technician, and date queries. SQLite foreign-key checks are enabled by the server.

## SQLite backup and restore

Stop the API before making a filesystem copy, or use SQLite's online backup command while it is running. With the local database at `server/prisma/faan.db`:

```powershell
Copy-Item server/prisma/faan.db .\faan-backup.db
```

Restore by stopping the server, copying the backup back to `server/prisma/faan.db`, then restarting:

```powershell
Copy-Item .\faan-backup.db server/prisma/faan.db -Force
```

Keep backups on durable storage with restricted access. Never commit the database file or `.env` secrets.

## Deploying to Vercel (free)

The project is set up so the React app and the Express API live in one Vercel project, while the SQLite database lives on Turso's free tier. Both tiers cost $0 per month and neither asks for a credit card.

- Vercel Hobby builds `client` to `client/dist` and routes every `/api/*` request to the catch-all function in `api/[...path].js`.
- `server/src/db.ts` uses the libSQL driver adapter when `TURSO_DATABASE_URL` is set, and falls back to the local SQLite file when it is not, so local development is unchanged.
- Vercel's filesystem is ephemeral. A deployment must never fall back to a local `faan.db`, because the file would be emptied on every cold start. The function refuses to start in production without `TURSO_DATABASE_URL`.

### 1. Create the database

Create a free account at `turso.tech`, then create a database and a token from the dashboard (or with the Turso CLI if you have it installed):

```
turso db create faan-ict
turso db show faan-ict
turso db tokens create faan-ict
```

That gives you a URL such as `libsql://faan-ict-<org>.turso.io` and an auth token.

### 2. Apply the schema and load the demo data

Prisma Migrate can only write to a local SQLite file, so `npm run db:turso` applies the checked-in migration SQL to the hosted database instead and records what it has already run. Add the two Turso values to `server/.env`, then:

```powershell
npm run db:turso
npm run db:seed
```

Both commands read `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` from `server/.env`.

### 3. Deploy

```powershell
npm i -g vercel
vercel link
vercel env add SESSION_SECRET production
vercel env add TURSO_DATABASE_URL production
vercel env add TURSO_AUTH_TOKEN production
vercel --prod
```

| Vercel environment variable | Value |
| --- | --- |
| `SESSION_SECRET` | at least 32 random characters |
| `TURSO_DATABASE_URL` | the `libsql://` URL from step 1 |
| `TURSO_AUTH_TOKEN` | the token from step 1 |

`DATABASE_URL` is not needed on Vercel: the deployment always uses the libSQL adapter. It stays in the Prisma schema so `prisma migrate` keeps working locally.

The build command is `npm run build`, which compiles the client, compiles the server, and regenerates the Prisma client. Every redeploy runs the same command.

## Hosting without Vercel

Use a Node.js host with persistent disk storage mounted at the database path. Run `npm run db:deploy` during release, set `SESSION_SECRET` and `DATABASE_URL` as environment variables, and serve the app over HTTPS so secure session cookies are enabled. Every app instance must use the same persistent database file on a filesystem that supports SQLite locking; separate instance-local files do not share records.

## LASU mark

The LASU logo is provided at `client/public/lasu-logo.png` and is used on the login screen, sidebar, and loading screen. Replace that file if an updated approved asset becomes available.
