"""Tests for backend/app/db.py — database operations."""

import json

import pytest

from app.db import DEFAULT_BOARD, get_board, init_db, save_board


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    """Give every test its own fresh SQLite database."""
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "pm.db"))


# ---------------------------------------------------------------------------
# init_db
# ---------------------------------------------------------------------------


def test_init_db_creates_tables_and_default_board() -> None:
    board, updated_at = get_board("user")
    assert len(board.columns) == 5
    assert len(board.cards) == 8
    assert updated_at


def test_init_db_is_idempotent() -> None:
    """Calling init_db() twice must not raise or duplicate data."""
    init_db()
    init_db()
    board, _ = get_board("user")
    assert len(board.columns) == 5


# ---------------------------------------------------------------------------
# get_board
# ---------------------------------------------------------------------------


def test_get_board_returns_default_for_known_user() -> None:
    board, updated_at = get_board("user")
    col_ids = [c.id for c in board.columns]
    assert "col-backlog" in col_ids
    assert "col-done" in col_ids
    assert updated_at


def test_get_board_seeds_default_for_new_user() -> None:
    """A brand-new username gets a seeded default board."""
    board, updated_at = get_board("newuser")
    assert len(board.columns) == 5
    assert updated_at


def test_get_board_returns_same_data_for_different_users() -> None:
    """Each user gets their own independent board."""
    board_a, _ = get_board("alice")
    board_b, _ = get_board("bob")
    # Both get the default board initially
    assert len(board_a.columns) == len(board_b.columns)


# ---------------------------------------------------------------------------
# save_board
# ---------------------------------------------------------------------------


def test_save_board_persists_across_connections() -> None:
    """Saved board is retrievable in a new call (new connection)."""
    board, _ = get_board("user")
    board.columns[0].title = "Renamed Backlog"
    save_board("user", board)

    reloaded, _ = get_board("user")
    assert reloaded.columns[0].title == "Renamed Backlog"


def test_save_board_returns_updated_at_timestamp() -> None:
    board, _ = get_board("user")
    updated_at = save_board("user", board)
    assert updated_at
    assert "T" in updated_at  # ISO 8601 format


def test_save_board_overwrites_previous_state() -> None:
    board, _ = get_board("user")

    board.columns[0].title = "First Save"
    save_board("user", board)

    board.columns[0].title = "Second Save"
    save_board("user", board)

    reloaded, _ = get_board("user")
    assert reloaded.columns[0].title == "Second Save"


def test_save_board_isolates_users() -> None:
    """Saving for one user must not affect another user's board."""
    board_alice, _ = get_board("alice")
    board_alice.columns[0].title = "Alice's column"
    save_board("alice", board_alice)

    board_bob, _ = get_board("bob")
    assert board_bob.columns[0].title != "Alice's column"


def test_save_board_preserves_all_cards() -> None:
    board, _ = get_board("user")
    original_card_count = len(board.cards)
    save_board("user", board)

    reloaded, _ = get_board("user")
    assert len(reloaded.cards) == original_card_count


def test_default_board_structure_matches_expected() -> None:
    """Sanity check: DEFAULT_BOARD constant matches the seeded data."""
    board, _ = get_board("user")
    default_col_ids = {c["id"] for c in DEFAULT_BOARD["columns"]}
    loaded_col_ids = {c.id for c in board.columns}
    assert default_col_ids == loaded_col_ids
