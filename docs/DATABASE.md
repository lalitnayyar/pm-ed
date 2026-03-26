# Database Model (Part 5)

## Goals

- Support multiple users in schema design.
- Keep MVP simple.
- Store exactly one Kanban board per user as a JSON blob.
- Use SQLite and create database automatically if missing.

## Storage Choice

Use SQLite with one row per user board.

- Pros:
  - Simple persistence model for MVP
  - Flexible board shape while frontend/backed models evolve
  - Easy full-board read/write operations
- Tradeoff:
  - No per-card relational querying in MVP

## Schema

```sql
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS boards (
  user_id INTEGER PRIMARY KEY,
  board_json TEXT NOT NULL CHECK (json_valid(board_json)),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
```

## Why This Meets Requirements

- "Multiple users for future": `users` table supports many users.
- "One board per user": `boards.user_id` is the primary key.
- "Save as JSON": `board_json` stores full board payload as JSON text with `json_valid` check.

## Board JSON Shape

`board_json` stores this shape:

```json
{
  "columns": [
    { "id": "col-backlog", "title": "Backlog", "cardIds": ["card-1"] }
  ],
  "cards": {
    "card-1": {
      "id": "card-1",
      "title": "Example",
      "details": "Example details"
    }
  }
}
```

## Backend Access Pattern

### Read board for user

1. Resolve user by username.
2. Read `boards.board_json` by `user_id`.
3. If no row exists, initialize with default board JSON and return it.

### Update board for user

1. Validate incoming JSON shape at API boundary.
2. Upsert `boards` row by `user_id`.
3. Update `updated_at` on each write.

Example upsert:

```sql
INSERT INTO boards (user_id, board_json, updated_at)
VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
ON CONFLICT(user_id)
DO UPDATE SET
  board_json = excluded.board_json,
  updated_at = excluded.updated_at;
```

## Bootstrap Rules

On backend startup:

1. Create database file if missing.
2. Run table/index DDL idempotently.
3. Ensure MVP user exists (`user`).
4. Ensure board row for MVP user exists (seed with default board JSON if missing).

## API Implications (for Part 6)

- `GET /api/board`: returns parsed board JSON for current user.
- `PUT /api/board`: replaces board JSON for current user after validation.

This keeps API design small and aligned to one-board-per-user storage.
