"""Database layer: SQLite with multi-board support and user auth."""

import json
import os
import sqlite3
from pathlib import Path

from app.auth import create_token, hash_password, verify_password
from app.models import BoardData, BoardInfo, UserResponse


DEFAULT_USERNAME = "user"
DEFAULT_PASSWORD = "password"

DEFAULT_BOARD: dict = {
    "columns": [
        {"id": "col-backlog", "title": "Backlog", "cardIds": ["card-1", "card-2"]},
        {"id": "col-discovery", "title": "Discovery", "cardIds": ["card-3"]},
        {"id": "col-progress", "title": "In Progress", "cardIds": ["card-4", "card-5"]},
        {"id": "col-review", "title": "Review", "cardIds": ["card-6"]},
        {"id": "col-done", "title": "Done", "cardIds": ["card-7", "card-8"]},
    ],
    "cards": {
        "card-1": {
            "id": "card-1",
            "title": "Align roadmap themes",
            "details": "Draft quarterly themes with impact statements and metrics.",
        },
        "card-2": {
            "id": "card-2",
            "title": "Gather customer signals",
            "details": "Review support tags, sales notes, and churn feedback.",
        },
        "card-3": {
            "id": "card-3",
            "title": "Prototype analytics view",
            "details": "Sketch initial dashboard layout and key drill-downs.",
        },
        "card-4": {
            "id": "card-4",
            "title": "Refine status language",
            "details": "Standardize column labels and tone across the board.",
        },
        "card-5": {
            "id": "card-5",
            "title": "Design card layout",
            "details": "Add hierarchy and spacing for scanning dense lists.",
        },
        "card-6": {
            "id": "card-6",
            "title": "QA micro-interactions",
            "details": "Verify hover, focus, and loading states.",
        },
        "card-7": {
            "id": "card-7",
            "title": "Ship marketing page",
            "details": "Final copy approved and asset pack delivered.",
        },
        "card-8": {
            "id": "card-8",
            "title": "Close onboarding sprint",
            "details": "Document release notes and share internally.",
        },
    },
}


def get_db_path() -> Path:
    configured = os.getenv("PM_DB_PATH")
    if configured:
        return Path(configured)
    return Path(__file__).resolve().parent.parent / "data" / "pm.db"


def _connect(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(db_path)
    connection.row_factory = sqlite3.Row
    return connection


def _boards_table_is_multi(connection: sqlite3.Connection) -> bool:
    """Return True if the boards table uses the new multi-board schema (has 'id' column)."""
    cursor = connection.execute("PRAGMA table_info(boards)")
    cols = {row["name"] for row in cursor.fetchall()}
    return "id" in cols


def _migrate_boards_to_multi(connection: sqlite3.Connection) -> None:
    """Migrate from single-board-per-user schema to multi-board schema."""
    connection.execute("ALTER TABLE boards RENAME TO boards_legacy")
    connection.execute(
        """
        CREATE TABLE boards (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL DEFAULT 'My Board',
          description TEXT NOT NULL DEFAULT '',
          board_json TEXT NOT NULL CHECK (json_valid(board_json)),
          created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
        """
    )
    # Copy existing boards
    connection.execute(
        """
        INSERT INTO boards (user_id, name, board_json, updated_at)
        SELECT user_id, 'My Board', board_json, updated_at
        FROM boards_legacy
        """
    )
    connection.execute("DROP TABLE boards_legacy")


def _users_table_columns(connection: sqlite3.Connection) -> set[str]:
    cursor = connection.execute("PRAGMA table_info(users)")
    return {row["name"] for row in cursor.fetchall()}


def init_db() -> None:
    db_path = get_db_path()
    with _connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")

        # ── users ───────────────────────────────────────────────────────────
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              email TEXT,
              password_hash TEXT,
              created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
            """
        )

        # Ensure optional columns exist (add individually so partial migrations work)
        existing_cols = _users_table_columns(connection)
        if "password_hash" not in existing_cols:
            connection.execute("ALTER TABLE users ADD COLUMN password_hash TEXT")
        if "email" not in existing_cols:
            # SQLite does not support ADD COLUMN ... UNIQUE; use a separate index
            connection.execute("ALTER TABLE users ADD COLUMN email TEXT")
        connection.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL"
        )

        # ── boards ──────────────────────────────────────────────────────────
        boards_exists = connection.execute(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='boards'"
        ).fetchone()

        if boards_exists and not _boards_table_is_multi(connection):
            _migrate_boards_to_multi(connection)
        else:
            connection.execute(
                """
                CREATE TABLE IF NOT EXISTS boards (
                  id INTEGER PRIMARY KEY AUTOINCREMENT,
                  user_id INTEGER NOT NULL,
                  name TEXT NOT NULL DEFAULT 'My Board',
                  description TEXT NOT NULL DEFAULT '',
                  board_json TEXT NOT NULL CHECK (json_valid(board_json)),
                  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
                  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
                """
            )

        # ── sessions ────────────────────────────────────────────────────────
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              user_id INTEGER NOT NULL,
              token TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )

        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token)"
        )

        # Ensure the default demo user exists with a known password
        existing = connection.execute(
            "SELECT id, password_hash FROM users WHERE username = ?", (DEFAULT_USERNAME,)
        ).fetchone()

        if not existing:
            pw_hash = hash_password(DEFAULT_PASSWORD)
            connection.execute(
                "INSERT INTO users (username, password_hash) VALUES (?, ?)",
                (DEFAULT_USERNAME, pw_hash),
            )
        elif not existing["password_hash"]:
            # Migrate legacy user: set a default password
            pw_hash = hash_password(DEFAULT_PASSWORD)
            connection.execute(
                "UPDATE users SET password_hash = ? WHERE username = ?",
                (pw_hash, DEFAULT_USERNAME),
            )

        # Ensure demo user has a default board
        user_row = connection.execute(
            "SELECT id FROM users WHERE username = ?", (DEFAULT_USERNAME,)
        ).fetchone()
        user_id = int(user_row["id"])

        board_row = connection.execute(
            "SELECT id FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not board_row:
            connection.execute(
                """
                INSERT INTO boards (user_id, name, board_json)
                VALUES (?, 'My Board', ?)
                """,
                (user_id, json.dumps(DEFAULT_BOARD)),
            )

        connection.commit()


# ── Auth operations ───────────────────────────────────────────────────────────

def register_user(username: str, password: str, email: str | None = None) -> tuple[UserResponse, str]:
    """Create a new user and return (user, token)."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        existing = connection.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if existing:
            raise ValueError(f"Username '{username}' is already taken")

        if email:
            email_exists = connection.execute(
                "SELECT id FROM users WHERE email = ?", (email,)
            ).fetchone()
            if email_exists:
                raise ValueError("Email address is already registered")

        pw_hash = hash_password(password)
        connection.execute(
            "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
            (username, email, pw_hash),
        )
        user_row = connection.execute(
            "SELECT id, username, email, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        user_id = int(user_row["id"])

        # Create a default board for the new user
        connection.execute(
            "INSERT INTO boards (user_id, name, board_json) VALUES (?, 'My Board', ?)",
            (user_id, json.dumps(DEFAULT_BOARD)),
        )

        # Create session token
        token = create_token()
        connection.execute(
            "INSERT INTO sessions (user_id, token) VALUES (?, ?)",
            (user_id, token),
        )
        connection.commit()

        user = UserResponse(
            id=user_id,
            username=str(user_row["username"]),
            email=user_row["email"],
            created_at=str(user_row["created_at"]),
        )
        return user, token


def login_user(username: str, password: str) -> tuple[UserResponse, str]:
    """Verify credentials and return (user, token)."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        row = connection.execute(
            "SELECT id, username, email, password_hash, created_at FROM users WHERE username = ?",
            (username,),
        ).fetchone()
        if not row or not row["password_hash"]:
            raise ValueError("Invalid username or password")
        if not verify_password(password, str(row["password_hash"])):
            raise ValueError("Invalid username or password")

        user_id = int(row["id"])
        token = create_token()
        connection.execute(
            "INSERT INTO sessions (user_id, token) VALUES (?, ?)",
            (user_id, token),
        )
        connection.commit()

        user = UserResponse(
            id=user_id,
            username=str(row["username"]),
            email=row["email"],
            created_at=str(row["created_at"]),
        )
        return user, token


def logout_user(token: str) -> None:
    """Delete a session token."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        connection.execute("DELETE FROM sessions WHERE token = ?", (token,))
        connection.commit()


def get_user_by_token(token: str) -> UserResponse | None:
    """Return the user associated with a session token, or None."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        row = connection.execute(
            """
            SELECT u.id, u.username, u.email, u.created_at
            FROM sessions s
            JOIN users u ON u.id = s.user_id
            WHERE s.token = ?
            """,
            (token,),
        ).fetchone()
        if not row:
            return None
        return UserResponse(
            id=int(row["id"]),
            username=str(row["username"]),
            email=row["email"],
            created_at=str(row["created_at"]),
        )


# ── Board operations ──────────────────────────────────────────────────────────

def list_boards(user_id: int) -> list[BoardInfo]:
    """Return all boards for a user."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        rows = connection.execute(
            "SELECT id, name, description, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY created_at ASC",
            (user_id,),
        ).fetchall()
        return [
            BoardInfo(
                id=int(r["id"]),
                name=str(r["name"]),
                description=str(r["description"]),
                created_at=str(r["created_at"]),
                updated_at=str(r["updated_at"]),
            )
            for r in rows
        ]


def create_board(user_id: int, name: str, description: str = "") -> BoardInfo:
    """Create a new board for a user and return its info."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        connection.execute(
            "INSERT INTO boards (user_id, name, description, board_json) VALUES (?, ?, ?, ?)",
            (user_id, name, description, json.dumps(DEFAULT_BOARD)),
        )
        connection.commit()
        row = connection.execute(
            "SELECT id, name, description, created_at, updated_at FROM boards WHERE user_id = ? ORDER BY id DESC LIMIT 1",
            (user_id,),
        ).fetchone()
        return BoardInfo(
            id=int(row["id"]),
            name=str(row["name"]),
            description=str(row["description"]),
            created_at=str(row["created_at"]),
            updated_at=str(row["updated_at"]),
        )


def get_board_by_id(board_id: int, user_id: int) -> tuple[BoardData, str, str, str] | None:
    """Return (board_data, name, description, updated_at) or None if not found/not owned."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        row = connection.execute(
            "SELECT board_json, name, description, updated_at FROM boards WHERE id = ? AND user_id = ?",
            (board_id, user_id),
        ).fetchone()
        if not row:
            return None
        board_data = BoardData.model_validate(json.loads(str(row["board_json"])))
        return board_data, str(row["name"]), str(row["description"]), str(row["updated_at"])


def save_board_by_id(board_id: int, user_id: int, board: BoardData) -> str:
    """Save board data and return updated_at. Raises ValueError if not found."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        result = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if not result:
            raise ValueError("Board not found or access denied")
        connection.execute(
            """
            UPDATE boards
            SET board_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
            WHERE id = ? AND user_id = ?
            """,
            (board.model_dump_json(), board_id, user_id),
        )
        connection.commit()
        row = connection.execute(
            "SELECT updated_at FROM boards WHERE id = ?", (board_id,)
        ).fetchone()
        return str(row["updated_at"])


def update_board_meta(board_id: int, user_id: int, name: str | None, description: str | None) -> BoardInfo:
    """Update board name/description. Returns updated BoardInfo."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        row = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if not row:
            raise ValueError("Board not found or access denied")

        if name is not None:
            connection.execute(
                "UPDATE boards SET name = ? WHERE id = ?", (name, board_id)
            )
        if description is not None:
            connection.execute(
                "UPDATE boards SET description = ? WHERE id = ?", (description, board_id)
            )
        connection.commit()
        updated = connection.execute(
            "SELECT id, name, description, created_at, updated_at FROM boards WHERE id = ?",
            (board_id,),
        ).fetchone()
        return BoardInfo(
            id=int(updated["id"]),
            name=str(updated["name"]),
            description=str(updated["description"]),
            created_at=str(updated["created_at"]),
            updated_at=str(updated["updated_at"]),
        )


def delete_board(board_id: int, user_id: int) -> None:
    """Delete a board. Raises ValueError if not found or user has only one board."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        row = connection.execute(
            "SELECT id FROM boards WHERE id = ? AND user_id = ?", (board_id, user_id)
        ).fetchone()
        if not row:
            raise ValueError("Board not found or access denied")

        count = connection.execute(
            "SELECT COUNT(*) as cnt FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if int(count["cnt"]) <= 1:
            raise ValueError("Cannot delete your only board")

        connection.execute("DELETE FROM boards WHERE id = ?", (board_id,))
        connection.commit()


def get_default_board_id(user_id: int) -> int | None:
    """Return the first board ID for a user (used by legacy API)."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        row = connection.execute(
            "SELECT id FROM boards WHERE user_id = ? ORDER BY id ASC LIMIT 1",
            (user_id,),
        ).fetchone()
        return int(row["id"]) if row else None


# ── Legacy board operations (backward-compat with username-based API) ─────────

def _get_or_create_user_id(connection: sqlite3.Connection, username: str) -> int:
    row = connection.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row:
        return int(row["id"])
    connection.execute("INSERT INTO users (username) VALUES (?)", (username,))
    connection.commit()
    row = connection.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        raise RuntimeError("Unable to create user")
    return int(row["id"])


def get_board(username: str) -> tuple[BoardData, str]:
    """Legacy: get default board for a username."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        user_id = _get_or_create_user_id(connection, username)
        row = connection.execute(
            "SELECT id, board_json, updated_at FROM boards WHERE user_id = ? ORDER BY id ASC LIMIT 1",
            (user_id,),
        ).fetchone()

        if not row:
            connection.execute(
                "INSERT INTO boards (user_id, name, board_json) VALUES (?, 'My Board', ?)",
                (user_id, json.dumps(DEFAULT_BOARD)),
            )
            connection.commit()
            row = connection.execute(
                "SELECT id, board_json, updated_at FROM boards WHERE user_id = ? ORDER BY id ASC LIMIT 1",
                (user_id,),
            ).fetchone()

        if not row:
            raise RuntimeError("Unable to load board")

        board_data = BoardData.model_validate(json.loads(str(row["board_json"])))
        return board_data, str(row["updated_at"])


def save_board(username: str, board: BoardData) -> str:
    """Legacy: save default board for a username."""
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        user_id = _get_or_create_user_id(connection, username)
        row = connection.execute(
            "SELECT id FROM boards WHERE user_id = ? ORDER BY id ASC LIMIT 1",
            (user_id,),
        ).fetchone()

        if row:
            board_id = int(row["id"])
            connection.execute(
                """
                UPDATE boards
                SET board_json = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
                WHERE id = ?
                """,
                (board.model_dump_json(), board_id),
            )
        else:
            connection.execute(
                "INSERT INTO boards (user_id, name, board_json) VALUES (?, 'My Board', ?)",
                (user_id, board.model_dump_json()),
            )

        connection.commit()
        updated_row = connection.execute(
            "SELECT updated_at FROM boards WHERE user_id = ? ORDER BY id ASC LIMIT 1",
            (user_id,),
        ).fetchone()
        if not updated_row:
            raise RuntimeError("Unable to persist board")
        return str(updated_row["updated_at"])
