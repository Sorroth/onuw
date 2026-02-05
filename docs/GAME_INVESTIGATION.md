# Game Investigation Guide

This guide explains how to investigate completed games using the database views.

## Quick Start

To investigate a game, you need the **room code** (e.g., `676Y9X`).

```bash
# Connect to the database
docker exec -it onuw-postgres psql -U onuw -d onuw
```

Then run these queries:

```sql
-- 1. Game overview (players, roles, winner)
SELECT * FROM v_game_summary WHERE room_code = 'XXXXXX';

-- 2. Night actions (what happened during night)
SELECT * FROM v_game_night_actions WHERE room_code = 'XXXXXX';

-- 3. Votes (who voted for whom)
SELECT * FROM v_game_votes WHERE room_code = 'XXXXXX';

-- 4. Center cards
SELECT * FROM v_game_center_cards WHERE room_code = 'XXXXXX';

-- 5. Win conditions (why each team won/lost)
SELECT * FROM v_game_win_conditions WHERE room_code = 'XXXXXX';
```

## One-Liner Commands

Run these directly from your terminal without entering psql:

```bash
# Game summary
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM v_game_summary WHERE room_code = 'XXXXXX';"

# Night actions
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM v_game_night_actions WHERE room_code = 'XXXXXX';"

# Votes
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM v_game_votes WHERE room_code = 'XXXXXX';"

# Center cards
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM v_game_center_cards WHERE room_code = 'XXXXXX';"

# Win conditions
docker exec onuw-postgres psql -U onuw -d onuw -c "SELECT * FROM v_game_win_conditions WHERE room_code = 'XXXXXX';"
```

## View Descriptions

### v_game_summary
Shows all players in a game with their roles and results.

| Column | Description |
|--------|-------------|
| room_code | The game's room code |
| seat_position | Player's seat (0-9) |
| player_name | Display name or "Bot N" |
| starting_role | Role at start of night |
| final_role | Role after all swaps |
| is_winner | Whether player won |
| is_eliminated | Whether player was killed |
| votes_received | Number of votes received |
| winning_team | Which team won |

### v_game_night_actions
Shows all night actions in sequence order.

| Column | Description |
|--------|-------------|
| sequence_order | Order of action (0 = first) |
| actor_seat | Seat of player who acted |
| performed_as_role | Role they acted as |
| action_type | VIEW, SWAP, etc. |
| copied_role | (Doppelganger) What role was copied |
| copied_from_seat | (Doppelganger) Who was copied |
| swap_from_seat | (Robber/TM) Source player seat |
| swap_to_seat | (Robber/TM) Target player seat |
| swap_to_center | (Drunk) Center position swapped with |
| viewed_cards | Cards seen (e.g., "Seat 3=WEREWOLF") |
| teammates_seen | Teammates found (e.g., "Seat 2, Seat 5") |

### v_game_votes
Shows final votes.

| Column | Description |
|--------|-------------|
| voter_seat | Who voted |
| voter_name | Voter's display name |
| target_seat | Who they voted for |
| target_name | Target's display name |

### v_game_center_cards
Shows center cards and changes.

| Column | Description |
|--------|-------------|
| position | Center position (0, 1, 2) |
| starting_role | Original role |
| final_role | Role after swaps |
| status | CHANGED or UNCHANGED |

### v_game_win_conditions
Shows why each team won or lost.

| Column | Description |
|--------|-------------|
| team | VILLAGE, WEREWOLF, or TANNER |
| team_won | true/false |
| reason | Explanation of outcome |

## Common Investigation Scenarios

### "Why did Werewolf win?"

```sql
-- Check who was eliminated
SELECT seat_position, player_name, final_role, is_eliminated
FROM v_game_summary
WHERE room_code = 'XXXXXX' AND is_eliminated = true;

-- Check win condition reason
SELECT * FROM v_game_win_conditions WHERE room_code = 'XXXXXX';
```

### "What role did Doppelganger copy?"

```sql
SELECT actor_name, copied_role, copied_from_seat
FROM v_game_night_actions
WHERE room_code = 'XXXXXX' AND performed_as_role = 'DOPPELGANGER';
```

### "Who swapped with whom?"

```sql
SELECT actor_name, performed_as_role, swap_from_seat, swap_to_seat, swap_to_center
FROM v_game_night_actions
WHERE room_code = 'XXXXXX' AND action_type = 'SWAP';
```

### "What did the Seer see?"

```sql
SELECT actor_name, viewed_cards
FROM v_game_night_actions
WHERE room_code = 'XXXXXX' AND performed_as_role = 'SEER';
```

### "Did Hunter ability trigger?"

Check if the eliminated player was a Hunter (or Doppelganger-Hunter):

```sql
-- Check eliminated player's role
SELECT s.seat_position, s.player_name, s.starting_role, s.final_role,
       na.copied_role as doppelganger_copied
FROM v_game_summary s
LEFT JOIN v_game_night_actions na ON s.room_code = na.room_code
  AND s.seat_position = na.actor_seat
  AND na.performed_as_role = 'DOPPELGANGER'
WHERE s.room_code = 'XXXXXX' AND s.is_eliminated = true;

-- Check who they voted for
SELECT * FROM v_game_votes
WHERE room_code = 'XXXXXX' AND voter_seat = <eliminated_seat>;
```

## Finding Recent Games

```sql
-- List recent completed games
SELECT DISTINCT room_code, status, winning_team
FROM v_game_summary
WHERE status = 'completed'
ORDER BY room_code DESC
LIMIT 10;
```

## Migration

These views are defined in `src/database/migrations/009_investigation_views.sql`.

If views are missing, run:
```bash
docker exec onuw-postgres psql -U onuw -d onuw -f /path/to/009_investigation_views.sql
```

Or manually apply the migration through the app's migration system.
