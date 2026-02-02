# ONUW Database User Guide

This guide explains how to use the PostgreSQL database system for the One Night Ultimate Werewolf game platform.

---

## Quick Start

### Starting the System

```bash
# Start the game server and database
docker-compose up -d

# Start with pgAdmin (database UI)
docker-compose --profile admin up -d
```

### Stopping the System

```bash
# Stop all services
docker-compose down

# Stop including pgAdmin
docker-compose --profile admin down
```

### Checking Status

```bash
# View running containers
docker-compose ps

# View logs
docker-compose logs -f           # All services
docker-compose logs -f onuw-server  # Just the game server
docker-compose logs -f postgres     # Just the database
```

---

## Accessing the Database

### Option 1: pgAdmin (Web UI)

1. **Start pgAdmin:**
   ```bash
   docker-compose --profile admin up -d
   ```

2. **Open in browser:** http://localhost:5050

3. **Login credentials:**
   - Email: `admin@example.com`
   - Password: `admin`

4. **Set a master password** (first time only) - choose any password you'll remember

5. **Add the database server:**
   - Right-click "Servers" → "Register" → "Server..."
   - **General tab:**
     - Name: `ONUW`
   - **Connection tab:**
     - Host: `postgres` (not localhost!)
     - Port: `5432`
     - Maintenance database: `onuw`
     - Username: `onuw`
     - Password: `onuw_secret_password`
     - Check "Save password"
   - Click "Save"

6. **Navigate to tables:**
   ```
   Servers → ONUW → Databases → onuw → Schemas → public → Tables
   ```

7. **View table data:**
   - Right-click any table → "View/Edit Data" → "All Rows"

### Option 2: Command Line (Quick Queries)

```bash
# List all tables
docker exec onuw-postgres psql -U onuw -d onuw -c "\dt"

# View users
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM users;"

# View user profiles (display names)
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM user_profiles;"

# View player statistics
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM player_statistics;"

# View games
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM games;"

# Interactive SQL session
docker exec -it onuw-postgres psql -U onuw -d onuw
```

---

## REST API Endpoints

Base URL: `http://localhost:8080`

### Authentication (Email/Password)

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/auth/register` | Create account | `{"email", "password", "displayName"}` |
| POST | `/api/auth/login` | Login | `{"email", "password"}` |
| POST | `/api/auth/logout` | Logout | (requires Authorization header) |
| GET | `/api/auth/me` | Get current user | (requires Authorization header) |

### Authentication (OAuth)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/auth/providers` | List configured OAuth providers |
| GET | `/api/auth/google` | Start Google OAuth flow |
| GET | `/api/auth/discord` | Start Discord OAuth flow |
| GET | `/api/auth/github` | Start GitHub OAuth flow |
| GET | `/api/auth/link/google` | Link Google to existing account (requires auth) |
| GET | `/api/auth/link/discord` | Link Discord to existing account (requires auth) |
| GET | `/api/auth/link/github` | Link GitHub to existing account (requires auth) |

### User Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/:id/stats` | Get player statistics |
| GET | `/api/users/:id/games` | Get player's game history |

### Game Data

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/games/:id` | Get game details |
| GET | `/api/games/:id/replay` | Get full game replay |

### Leaderboard & Stats

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leaderboard?limit=N&offset=N` | Get top players |
| GET | `/api/stats` | Get global statistics |

### Example: Register a User

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123","displayName":"MyName"}'
```

### Example: Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"SecurePass123"}'
```

Response includes a JWT token:
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "userId": "...", "email": "...", "displayName": "..." }
}
```

### Example: Get Stats (Authenticated)

```bash
curl http://localhost:8080/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

---

## Database Schema Overview

### User Tables

| Table | Purpose |
|-------|---------|
| `users` | Account credentials (email, password_hash) |
| `user_profiles` | Display name, avatar |
| `user_oauth_links` | OAuth provider connections |
| `sessions` | Active login sessions |
| `user_preferences` | User settings |

### Game Tables

| Table | Purpose |
|-------|---------|
| `games` | Game metadata (room code, status, timestamps) |
| `game_configurations` | Game settings (roles, durations) |
| `game_players` | Players in each game (seat, roles) |
| `center_cards` | Center card positions and roles |

### Game History Tables (Full Replay)

| Table | Purpose |
|-------|---------|
| `night_actions` | All night phase actions |
| `night_action_targets` | Who/what was targeted |
| `night_action_views` | What information was seen |
| `night_action_swaps` | Card swaps performed |
| `statements` | Day phase claims/statements |
| `votes` | Final votes |

### Statistics Tables (6NF Normalized)

| Table | Purpose |
|-------|---------|
| `player_statistics` | Overall win/loss record (aggregate) |
| `player_role_stats` | Per-role statistics (one row per user per role) |
| `player_team_stats` | Per-team statistics (one row per user per team) |
| `game_results` | Game outcomes |

**Why 6NF instead of JSONB?**

We use separate normalized tables instead of JSONB columns for statistics:

```
JSONB Approach (NOT USED):
┌─────────────────────────────────────────────────────────┐
│ player_statistics                                       │
│   role_statistics: {"werewolf": {"wins": 5}, ...}      │  ← Hard to query
│   team_statistics: {"village": {"wins": 10}, ...}      │  ← No foreign keys
└─────────────────────────────────────────────────────────┘

6NF Approach (USED):
┌──────────────────────┐  ┌──────────────────────┐
│ player_role_stats    │  │ player_team_stats    │
│   user_id            │  │   user_id            │
│   role_code ─────────┼──│   team_code ─────────┼── Foreign keys!
│   wins               │  │   wins               │
│   losses             │  │   losses             │
└──────────────────────┘  └──────────────────────┘
```

Benefits:
- **Foreign key enforcement**: `role_code` must exist in `roles` table
- **Easy aggregation**: "Top Werewolf players" is a simple SQL query
- **Indexable**: Fast lookups by role or team
- **Data integrity**: No typos or orphaned data possible

---

## Security Details

### Password Hashing

Passwords are hashed using **bcrypt** with 12 rounds:

```
$2b$12$MoPYavfYBvNXAtLmXp8H6u9uhPMPO9S2U6VqHacplGWdjDceqVVY2
│  │  │                                                      │
│  │  └── 22-char salt ─────────────────────────────────────────┘
│  └── Cost factor (2^12 = 4,096 iterations)
└── Algorithm version (bcrypt)
```

**Why this is secure:**
- **Adaptive cost**: Each hash attempt takes ~250ms
- **Built-in salt**: Rainbow tables are useless
- **Intentionally slow**: Brute-force attacks are impractical
- **Industry standard**: OWASP recommends 10-12 rounds

### JWT Tokens

- Algorithm: HS256
- Expiration: 7 days (configurable via `JWT_EXPIRES_IN`)
- Stored in: `sessions` table (token hash only)

### Environment Variables

Set in `docker-compose.yml`:

```yaml
DATABASE_URL=postgresql://onuw:onuw_secret_password@postgres:5432/onuw
JWT_SECRET=change-this-in-production-to-a-secure-random-string
JWT_EXPIRES_IN=7d
BCRYPT_ROUNDS=12
```

**Production Warning:** Change `JWT_SECRET` to a secure random string before deploying!

---

## OAuth Setup

OAuth allows users to login with Google, Discord, or GitHub instead of (or in addition to) email/password.

### Multiple Auth Methods Per Account

A single user account can have:
- **Email/Password** - Stored in `users.password_hash`
- **Multiple OAuth providers** - Each in `user_oauth_links` table

This means:
- User registers with email/password, then links Google → Can login with either
- User registers with Discord, then links GitHub → Can login with either
- User registers with Google, then adds a password → Can login with either

### Setup: Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Select **Web application**
6. Add authorized redirect URI: `http://localhost:8080/api/auth/google/callback`
7. Copy the **Client ID** and **Client Secret**
8. Add to `docker-compose.yml`:
   ```yaml
   - GOOGLE_CLIENT_ID=your-client-id-here
   - GOOGLE_CLIENT_SECRET=your-client-secret-here
   ```

### Setup: Discord OAuth

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Navigate to **OAuth2** → **General**
4. Add redirect URI: `http://localhost:8080/api/auth/discord/callback`
5. Copy the **Client ID** and **Client Secret**
6. Add to `docker-compose.yml`:
   ```yaml
   - DISCORD_CLIENT_ID=your-client-id-here
   - DISCORD_CLIENT_SECRET=your-client-secret-here
   ```

### Setup: GitHub OAuth

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **New OAuth App**
3. Set Homepage URL: `http://localhost:8080`
4. Set Authorization callback URL: `http://localhost:8080/api/auth/github/callback`
5. Copy the **Client ID** and generate a **Client Secret**
6. Add to `docker-compose.yml`:
   ```yaml
   - GITHUB_CLIENT_ID=your-client-id-here
   - GITHUB_CLIENT_SECRET=your-client-secret-here
   ```

### Using OAuth

**Check available providers:**
```bash
curl http://localhost:8080/api/auth/providers
```

**Login with OAuth (browser redirect):**
```
http://localhost:8080/api/auth/google
http://localhost:8080/api/auth/discord
http://localhost:8080/api/auth/github
```

**Get authorization URL as JSON (for SPA):**
```bash
curl "http://localhost:8080/api/auth/google?json=true"
```

**Link OAuth to existing account:**
```bash
# First login with email/password to get a token
# Then visit (with token in Authorization header):
curl -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:8080/api/auth/link/discord?json=true"
```

### OAuth Flow

```
┌─────────┐     GET /api/auth/google      ┌─────────────┐
│  User   │ ───────────────────────────▶  │ ONUW Server │
└────┬────┘                               └──────┬──────┘
     │                                           │
     │  ◀─── Redirect to Google ────────────────┘
     │
     ▼
┌─────────────┐
│   Google    │  User approves access
└──────┬──────┘
       │
       │  Redirect to /api/auth/google/callback?code=xxx
       ▼
┌─────────────┐     Exchange code      ┌─────────────┐
│ ONUW Server │ ◀────────────────────▶ │   Google    │
└──────┬──────┘     for tokens         └─────────────┘
       │
       │  Create/link account, return JWT
       ▼
┌─────────┐
│  User   │  Logged in!
└─────────┘
```

### Production Considerations

1. **Update BASE_URL** for production:
   ```yaml
   - BASE_URL=https://yourdomain.com
   ```

2. **Update OAuth redirect URIs** in each provider's console to match production URL

3. **Use HTTPS** in production - OAuth providers require it for redirect URIs

---

## Troubleshooting

### pgAdmin Won't Start

Check logs:
```bash
docker-compose logs pgadmin
```

Common issues:
- Email validation error → Fixed by using `admin@example.com`
- Port conflict → Change `5050:80` in docker-compose.yml

### Can't Connect to Database from pgAdmin

- **Use hostname `postgres`** (not `localhost`)
- Both containers must be on the same Docker network
- Verify password: `onuw_secret_password`

### Database Connection Refused

```bash
# Check if postgres is healthy
docker-compose ps

# Should show: Up (healthy)
```

### Reset Database

```bash
# Stop everything
docker-compose down

# Remove database volume (DELETES ALL DATA)
docker volume rm onuw_postgres_data

# Start fresh
docker-compose up -d
```

### View Database Logs

```bash
docker-compose logs -f postgres
```

---

## File Locations

| File | Purpose |
|------|---------|
| `docker-compose.yml` | Container configuration |
| `src/database/DatabaseService.ts` | Connection pool singleton |
| `src/database/DatabaseWriteQueue.ts` | Write queue with retry/DLQ |
| `src/database/migrations/*.sql` | Schema definitions |
| `src/database/repositories/*.ts` | Data access layer |
| `src/database/types.ts` | TypeScript interfaces for all tables |
| `src/services/AuthService.ts` | Authentication logic |
| `src/services/OAuthService.ts` | OAuth provider handling |
| `src/server/ApiHandler.ts` | REST API endpoints |
| `src/utils/password.ts` | Bcrypt hashing, JWT |
| `data/write-queue-backup.json` | Queue state backup (auto-created) |

---

## Database Migrations

**What is a migration?**

A migration moves your database schema from one state to another - like migrating between countries. Each migration file contains SQL that transforms the database structure.

### Migration Files

```
src/database/migrations/
├── 001_reference_data.sql   ← Base tables (roles, teams, action_types)
├── 002_users.sql            ← User accounts, profiles, sessions
├── 003_games.sql            ← Games, players, center cards
├── 004_game_events.sql      ← Night actions, statements, votes
├── 005_results.sql          ← Game results, player statistics
└── 006_6nf_decomposition.sql ← Normalize to 6NF (remove JSONB)
```

### How Migrations Work

```
Migration 005                    Migration 006
┌─────────────────────┐         ┌─────────────────────┐
│ player_statistics   │         │ player_statistics   │
│   - games_played    │   ───►  │   - games_played    │
│   - total_wins      │         │   - total_wins      │
│   - role_stats JSONB│ REMOVED │                     │
│   - team_stats JSONB│ REMOVED │ player_role_stats   │ NEW TABLE
└─────────────────────┘         │ player_team_stats   │ NEW TABLE
                                └─────────────────────┘
```

Migrations run in order (001, 002, 003...) and only apply changes not yet applied. This ensures everyone's database ends up in the same state.

### When to Create a Migration

- Adding a new table
- Adding/removing columns
- Changing constraints or indexes
- Refactoring schema (like JSONB → normalized tables)

---

## Common SQL Queries

### Find a User by Email

```sql
SELECT u.user_id, u.email, p.display_name, u.created_at
FROM users u
JOIN user_profiles p ON u.user_id = p.user_id
WHERE u.email = 'user@example.com';
```

### Get Player Statistics (Aggregate)

```sql
SELECT p.display_name, s.games_played, s.total_wins, s.total_losses,
       ROUND(s.total_wins::numeric / NULLIF(s.games_played, 0) * 100, 1) as win_rate
FROM player_statistics s
JOIN user_profiles p ON s.user_id = p.user_id
ORDER BY s.total_wins DESC;
```

### Get Player's Role Statistics (6NF)

```sql
SELECT p.display_name, r.role_name, prs.games_played, prs.wins, prs.losses,
       ROUND(prs.wins::numeric / NULLIF(prs.games_played, 0) * 100, 1) as win_rate
FROM player_role_stats prs
JOIN user_profiles p ON prs.user_id = p.user_id
JOIN roles r ON prs.role_code = r.role_code
WHERE p.display_name = 'Sorroth'
ORDER BY prs.games_played DESC;
```

### Get Top Werewolf Players (6NF)

```sql
SELECT p.display_name, prs.games_played, prs.wins,
       ROUND(prs.wins::numeric / NULLIF(prs.games_played, 0) * 100, 1) as win_rate
FROM player_role_stats prs
JOIN user_profiles p ON prs.user_id = p.user_id
WHERE prs.role_code = 'werewolf'
  AND prs.games_played >= 5
ORDER BY win_rate DESC, prs.wins DESC
LIMIT 10;
```

### Get Player's Team Statistics (6NF)

```sql
SELECT p.display_name, t.team_name, pts.games_played, pts.wins, pts.losses
FROM player_team_stats pts
JOIN user_profiles p ON pts.user_id = p.user_id
JOIN teams t ON pts.team_code = t.team_code
WHERE p.display_name = 'Sorroth';
```

### Get Recent Games

```sql
SELECT g.game_id, g.room_code, g.status, g.created_at,
       COUNT(gp.player_id) as player_count
FROM games g
LEFT JOIN game_players gp ON g.game_id = gp.game_id
GROUP BY g.game_id
ORDER BY g.created_at DESC
LIMIT 10;
```

### Get Game Replay (Night Actions)

```sql
SELECT na.sequence_order, up.display_name as actor, na.performed_as_role,
       at.name as action_type
FROM night_actions na
JOIN game_players gp ON na.actor_player_id = gp.player_id
JOIN user_profiles up ON gp.user_id = up.user_id
JOIN action_types at ON na.action_type_code = at.code
WHERE na.game_id = 'YOUR_GAME_ID'
ORDER BY na.sequence_order;
```

---

## Architecture Summary

```
┌─────────────────┐     ┌─────────────────┐
│   client.html   │────▶│  REST API       │
│   (Browser)     │     │  :8080/api/*    │
└────────┬────────┘     └────────┬────────┘
         │                       │
         │ WebSocket             │ HTTP
         │                       │
         ▼                       ▼
┌─────────────────────────────────────────┐
│           onuw-server                    │
│  ┌─────────────┐  ┌──────────────────┐  │
│  │GameServer   │  │   ApiHandler     │  │
│  │  Facade     │  │                  │  │
│  └──────┬──────┘  └────────┬─────────┘  │
│         │                  │            │
│         └────────┬─────────┘            │
│                  ▼                      │
│         ┌────────────────┐              │
│         │  Repositories  │              │
│         └────────┬───────┘              │
│                  ▼                      │
│         ┌────────────────┐              │
│         │  WriteQueue    │──▶ Backup    │
│         │  (retry/DLQ)   │   File       │
│         └────────┬───────┘              │
└──────────────────┼──────────────────────┘
                   │
                   ▼
         ┌─────────────────┐
         │    PostgreSQL   │
         │    (postgres)   │
         └─────────────────┘
```

---

## Database Write Queue

The `DatabaseWriteQueue` provides reliable database writes with automatic retry and graceful degradation. If the database is temporarily unavailable, game data is queued and retried automatically.

### How It Works

```
Game Event ──▶ WriteQueue ──▶ Execute ──▶ Database
                   │              │
                   │         ┌────┴────┐
                   │         │ Success │──▶ Done
                   │         └─────────┘
                   │              │
                   │         ┌────┴────┐
                   │         │ Failure │
                   │         └────┬────┘
                   │              │
                   │         ┌────┴────────────┐
                   │         │ Retry (3x max)  │
                   │         │ 200ms, 400ms,   │
                   │         │ 800ms backoff   │
                   │         └────┬────────────┘
                   │              │
                   │         ┌────┴────┐
                   │         │ All     │
                   │         │ Failed  │
                   │         └────┬────┘
                   │              │
                   │              ▼
                   │      ┌──────────────┐
                   └─────▶│ Dead Letter  │──▶ Auto-retry
                          │ Queue (DLQ)  │    every 5 min
                          └──────┬───────┘
                                 │
                                 ▼
                          ┌──────────────┐
                          │ File Backup  │
                          │ (persistence)│
                          └──────────────┘
```

### Features

| Feature | Description |
|---------|-------------|
| **Retry with Backoff** | 3 attempts with exponential backoff (200ms, 400ms, 800ms) |
| **Dead Letter Queue** | Failed items stored for later retry |
| **File Backup** | Queue state persisted to `data/write-queue-backup.json` |
| **Health Checks** | Database connectivity checked every 30 seconds |
| **Auto DLQ Retry** | DLQ automatically retried every 5 minutes when DB healthy |
| **Graceful Degradation** | Games continue even if database is down |

### What Gets Queued

All game-related database writes use the queue:

| Operation | Description |
|-----------|-------------|
| `saveGame` | Game creation when starting |
| `saveStatement` | Day phase statements |
| `updateStatus` | Game phase changes |
| `saveNightAction` | Night actions with 6NF details |
| `saveVote` | Player votes |
| `saveGameResults` | Final game results and statistics |

### Monitoring the Queue

The queue statistics are available programmatically:

```typescript
import { getWriteQueue } from './database';

const queue = getWriteQueue();
const stats = queue.getStats();

console.log(`Queue size: ${stats.queueSize}`);
console.log(`DLQ size: ${stats.dlqSize}`);
console.log(`Successes: ${stats.successCount}`);
console.log(`Failures: ${stats.failureCount}`);
console.log(`DB healthy: ${stats.isDbHealthy}`);
```

### Manual DLQ Management

```typescript
// Manually retry all DLQ items
queue.retryDlq();

// View DLQ items
const dlqItems = queue.getDlqItems();
for (const item of dlqItems) {
  console.log(`${item.type}: ${item.lastError}`);
}

// Clear DLQ (use with caution - data may be lost)
queue.clearDlq();
```

### File Backup Location

Queue state is saved to: `data/write-queue-backup.json`

This allows recovery of pending writes after server restarts. Note that executable functions cannot be restored from backup, so orphaned commands from previous runs will be logged and discarded.

### Troubleshooting

**Queue keeps growing:**
- Check database connectivity: `docker-compose logs postgres`
- Verify DATABASE_URL environment variable
- Check for database disk space issues

**DLQ has many items:**
- Items in DLQ failed 3 times - check `lastError` for each item
- Common causes: constraint violations, missing foreign keys
- Use `queue.getDlqItems()` to inspect failed items

**File backup errors:**
- Ensure `data/` directory exists and is writable
- Check disk space on server

### Design Patterns Used

| Pattern | Usage |
|---------|-------|
| **Singleton** | Single queue instance across application |
| **Command** | Write operations encapsulated as executable commands |
| **Strategy** | Configurable retry strategy (attempts, delays) |
| **Memento** | File backup captures queue state for persistence |
| **Proxy** | Queue wraps database operations with reliability |

---

## Normalization Compliance

This database follows **Practical 6NF** - all multi-valued dependencies are decomposed, with zero JSONB columns in tables.

### Normal Form Audit Summary

| Normal Form | Status | Notes |
|-------------|--------|-------|
| **UNF** | ✓ Pass | No repeating groups |
| **1NF** | ✓ Pass | All values atomic (no JSONB in tables) |
| **2NF** | ✓ Pass | No partial dependencies |
| **3NF** | ✓ Pass | No transitive dependencies |
| **EKNF** | ✓ Pass | Elementary key normal form satisfied |
| **BCNF** | ✓ Pass | Every determinant is a candidate key |
| **4NF** | ✓ Pass | No multi-valued dependencies |
| **ETNF** | ✓ Pass | Essential tuple normal form satisfied |
| **5NF** | ✓ Pass | No join dependencies |
| **DKNF** | ✓ Pass | Domain-key constraints enforced |
| **6NF** | Practical | Multi-valued deps decomposed; aggregate tables kept for performance |

### JSONB Columns Removed

The following JSONB columns were removed and replaced with normalized tables:

| Table | Removed Column | Replaced By |
|-------|----------------|-------------|
| `player_statistics` | `role_statistics` | `player_role_stats` table |
| `player_statistics` | `team_statistics` | `player_team_stats` table |
| `night_actions` | `action_details` | 5 decomposed tables (see below) |
| `user_preferences` | `preference_value` (JSONB) | `preference_value` (TEXT) |

### Night Action Decomposition

The `night_actions.action_details` JSONB was decomposed into 5 normalized tables:

```
night_actions (core action record)
    │
    ├── night_action_targets   ← Who/what was targeted
    ├── night_action_views     ← What roles were seen
    ├── night_action_swaps     ← Swap operation details
    ├── night_action_copies    ← Doppelganger copy details
    └── night_action_teammates ← Teammates seen (Werewolf/Mason)
```

### 6NF Tables in This Schema

| Table | Key | Purpose |
|-------|-----|---------|
| `player_role_stats` | (user_id, role_code) | Per-role statistics |
| `player_team_stats` | (user_id, team_code) | Per-team statistics |
| `night_action_targets` | (action_id, target_order) | Action targets |
| `night_action_views` | (action_id, view_order) | Roles viewed |
| `night_action_swaps` | action_id | Swap details |
| `night_action_copies` | action_id | Copy details |
| `night_action_teammates` | (action_id, teammate_player_id) | Teammates seen |
| `game_role_selections` | (game_id, slot_index) | Role configuration |

### Why No JSONB?

1. **Foreign key enforcement** - `role_code` must exist in `roles` table
2. **Queryable** - "Top Werewolf players" is a simple SQL JOIN
3. **Indexable** - Every column can be indexed
4. **Type-safe** - Database enforces data types
5. **No parsing** - No JSON manipulation needed

### Verification Query

Run this to verify no JSONB columns exist in tables:

```sql
SELECT table_name, column_name
FROM information_schema.columns c
JOIN information_schema.tables t USING (table_name, table_schema)
WHERE c.data_type = 'jsonb'
  AND t.table_type = 'BASE TABLE'
  AND c.table_schema = 'public';
-- Should return 0 rows
```

### Views May Use JSONB

Views (not tables) may use JSONB to aggregate data for API responses:

```sql
-- This is OK - views aggregate normalized data for display
SELECT * FROM v_player_stats_with_roles;  -- Returns JSONB for convenience
SELECT * FROM v_night_action_details;     -- Reconstructs action details
```

The underlying tables remain fully normalized.

---

## Next Steps

1. **Play games** to populate statistics
2. **Check leaderboard** at `/api/leaderboard`
3. **View game replays** after games complete
4. **Build frontend** to display stats in the game UI
