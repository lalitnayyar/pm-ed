import json
import os
import sqlite3
from pathlib import Path

from app.models import BoardData


DEFAULT_USERNAME = "user"

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


def _get_or_create_user(connection: sqlite3.Connection, username: str) -> int:
    row = connection.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if row:
        return int(row["id"])

    connection.execute("INSERT INTO users (username) VALUES (?)", (username,))
    row = connection.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
    if not row:
        raise RuntimeError("Unable to create user")
    return int(row["id"])


def init_db() -> None:
    db_path = get_db_path()
    with _connect(db_path) as connection:
        connection.execute("PRAGMA foreign_keys = ON")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              username TEXT NOT NULL UNIQUE,
              created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS boards (
              user_id INTEGER PRIMARY KEY,
              board_json TEXT NOT NULL CHECK (json_valid(board_json)),
              updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
              FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS idx_users_username ON users(username)"
        )

        user_id = _get_or_create_user(connection, DEFAULT_USERNAME)
        board_row = connection.execute(
            "SELECT user_id FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not board_row:
            connection.execute(
                """
                INSERT INTO boards (user_id, board_json, updated_at)
                VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                """,
                (user_id, json.dumps(DEFAULT_BOARD)),
            )

        connection.commit()


def get_board(username: str) -> tuple[BoardData, str]:
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        user_id = _get_or_create_user(connection, username)
        row = connection.execute(
            "SELECT board_json, updated_at FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()

        if not row:
            connection.execute(
                """
                INSERT INTO boards (user_id, board_json, updated_at)
                VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
                """,
                (user_id, json.dumps(DEFAULT_BOARD)),
            )
            connection.commit()
            row = connection.execute(
                "SELECT board_json, updated_at FROM boards WHERE user_id = ?", (user_id,)
            ).fetchone()

        if not row:
            raise RuntimeError("Unable to load board")

        board_data = BoardData.model_validate(json.loads(str(row["board_json"])))
        return board_data, str(row["updated_at"])


def save_board(username: str, board: BoardData) -> str:
    init_db()
    db_path = get_db_path()
    with _connect(db_path) as connection:
        user_id = _get_or_create_user(connection, username)
        connection.execute(
            """
            INSERT INTO boards (user_id, board_json, updated_at)
            VALUES (?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
            ON CONFLICT(user_id)
            DO UPDATE SET
              board_json = excluded.board_json,
              updated_at = excluded.updated_at
            """,
            (user_id, board.model_dump_json()),
        )
        connection.commit()

        row = connection.execute(
            "SELECT updated_at FROM boards WHERE user_id = ?", (user_id,)
        ).fetchone()
        if not row:
            raise RuntimeError("Unable to persist board")

        return str(row["updated_at"])
