# Local Development Setup

Quick guide to run ONUW locally with hot-reloading for rapid development.

## Prerequisites

- Node.js 20+
- Docker Desktop running

## Quick Start (After First-Time Setup)

```bash
# Terminal 1 - Start Postgres & Backend
docker-compose up -d postgres
npm run dev

# Terminal 2 - Start Frontend
cd frontend
npm run dev
```

Open http://localhost:3000

---

## First-Time Setup

### 1. Stop Local Postgres (if installed)

If you have a local Postgres installation, stop it first to avoid port conflicts:

1. Press `Win + R`, type `services.msc`, press Enter
2. Find your postgres service (e.g., "postgresql-x64-18"), right-click → **Stop**

Or check what's using port 5432:
```bash
netstat -ano | findstr :5432
```

### 2. Start Docker Postgres

```bash
docker-compose up -d postgres
```

### 3. Fix Password Authentication

The Docker container needs the password set with scram-sha-256 encryption:

```bash
docker exec onuw-postgres psql -U onuw -c "SET password_encryption = 'scram-sha-256'; ALTER USER onuw WITH PASSWORD 'onuw_secret_password';"
```

### 4. Run Database Migrations

```bash
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/001_reference_data.sql
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/002_users.sql
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/003_games.sql
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/004_game_events.sql
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/005_results.sql
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/006_6nf_decomposition.sql
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/007_fix_enum_case.sql
docker exec -i onuw-postgres psql -U onuw -d onuw < src/database/migrations/008_add_admin_flag.sql
```

### 5. Verify .env Files

**Backend `.env`:**
```env
DATABASE_URL=postgresql://onuw:onuw_secret_password@localhost:5432/onuw
```

**Frontend `frontend/.env.local`:**
```env
NEXT_PUBLIC_WS_URL=ws://localhost:8080
AUTH_URL=http://localhost:3000
AUTH_SECRET=onuw-local-dev-secret-key-32chars
```

### 6. Start Development Servers

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

---

## Services Summary

| Service | URL | Hot Reload |
|---------|-----|------------|
| Frontend | http://localhost:3000 | Yes (instant) |
| Backend | ws://localhost:8080 | Yes (~1s restart) |
| Postgres | localhost:5432 | N/A |

---

## Troubleshooting

### "Not authenticated" in UI

1. Make sure backend is fully started (shows the banner with "Game server started")
2. Check no old processes on port 8080: `netstat -ano | findstr :8080`
3. Kill stale processes if needed: `taskkill /PID <PID> /F`
4. Refresh the browser

### Port 8080 already in use

```bash
netstat -ano | findstr :8080
taskkill /PID <PID> /F
```

### Port 3000 already in use

```bash
netstat -ano | findstr :3000
taskkill /PID <PID> /F
```

### Next.js lock file error

If you see `Unable to acquire lock at .next/dev/lock`:

```bash
# Remove the stale lock file
rm -rf frontend/.next/dev/lock

# Or on Windows PowerShell
Remove-Item -Recurse -Force frontend\.next\dev\lock
```

This happens when the frontend crashes or is killed without proper cleanup.

### Database "password authentication failed"

Re-run the password fix:
```bash
docker exec onuw-postgres psql -U onuw -c "SET password_encryption = 'scram-sha-256'; ALTER USER onuw WITH PASSWORD 'onuw_secret_password';"
```

### Local Postgres conflicts with Docker

Stop your local Postgres service (see First-Time Setup step 1).

---

## Stopping Services

```bash
# Stop dev servers
Ctrl+C in each terminal

# Stop Postgres
docker-compose stop postgres
```

---

## Full Docker Mode (for production testing)

If you need to test the full Docker setup:

```bash
docker-compose up -d --build
```

This rebuilds containers (~2-3 minutes) but matches production environment.
