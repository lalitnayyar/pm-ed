"""Tests for multi-board and user auth DB operations."""

import pytest

from app.db import (
    create_board,
    delete_board,
    get_board_by_id,
    get_default_board_id,
    get_user_by_token,
    init_db,
    list_boards,
    login_user,
    logout_user,
    register_user,
    save_board_by_id,
    update_board_meta,
)
from app.models import BoardData


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "test.db"))


# ── Registration ──────────────────────────────────────────────────────────────

class TestRegisterUser:
    def test_register_creates_user_and_token(self) -> None:
        user, token = register_user("alice", "password123")
        assert user.username == "alice"
        assert user.id > 0
        assert len(token) >= 32

    def test_register_creates_default_board(self) -> None:
        user, _ = register_user("bob", "pw12345")
        boards = list_boards(user.id)
        assert len(boards) == 1
        assert boards[0].name == "My Board"

    def test_register_duplicate_username_raises(self) -> None:
        register_user("charlie", "pw12345")
        with pytest.raises(ValueError, match="already taken"):
            register_user("charlie", "other")

    def test_register_with_email(self) -> None:
        user, _ = register_user("dana", "pw12345", email="dana@example.com")
        assert user.email == "dana@example.com"

    def test_register_duplicate_email_raises(self) -> None:
        register_user("u1", "pw12345", email="shared@example.com")
        with pytest.raises(ValueError, match="already registered"):
            register_user("u2", "pw12345", email="shared@example.com")


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLoginUser:
    def test_login_returns_user_and_token(self) -> None:
        register_user("eve", "secret99")
        user, token = login_user("eve", "secret99")
        assert user.username == "eve"
        assert len(token) >= 32

    def test_login_wrong_password_raises(self) -> None:
        register_user("frank", "correct")
        with pytest.raises(ValueError, match="Invalid"):
            login_user("frank", "wrong")

    def test_login_unknown_user_raises(self) -> None:
        with pytest.raises(ValueError, match="Invalid"):
            login_user("nobody", "pw")

    def test_login_creates_new_token_each_time(self) -> None:
        register_user("grace", "pw12345")
        _, tok1 = login_user("grace", "pw12345")
        _, tok2 = login_user("grace", "pw12345")
        assert tok1 != tok2

    def test_default_demo_user_can_login(self) -> None:
        init_db()
        user, token = login_user("user", "password")
        assert user.username == "user"
        assert token


# ── Session token lookup ──────────────────────────────────────────────────────

class TestGetUserByToken:
    def test_valid_token_returns_user(self) -> None:
        user, token = register_user("heidi", "pw12345")
        found = get_user_by_token(token)
        assert found is not None
        assert found.username == "heidi"

    def test_invalid_token_returns_none(self) -> None:
        assert get_user_by_token("bogus-token") is None

    def test_logged_out_token_returns_none(self) -> None:
        _, token = register_user("ivan", "pw12345")
        logout_user(token)
        assert get_user_by_token(token) is None


# ── Logout ────────────────────────────────────────────────────────────────────

class TestLogout:
    def test_logout_invalidates_token(self) -> None:
        _, token = register_user("judy", "pw12345")
        logout_user(token)
        assert get_user_by_token(token) is None

    def test_logout_unknown_token_is_noop(self) -> None:
        logout_user("nonexistent")  # should not raise


# ── Board CRUD ────────────────────────────────────────────────────────────────

class TestListBoards:
    def test_new_user_has_one_board(self) -> None:
        user, _ = register_user("kim", "pw12345")
        boards = list_boards(user.id)
        assert len(boards) == 1

    def test_boards_sorted_by_created_at(self) -> None:
        user, _ = register_user("leo", "pw12345")
        create_board(user.id, "Board B")
        create_board(user.id, "Board C")
        boards = list_boards(user.id)
        assert boards[0].name == "My Board"
        assert boards[-1].name == "Board C"


class TestCreateBoard:
    def test_creates_board_with_name(self) -> None:
        user, _ = register_user("meg", "pw12345")
        info = create_board(user.id, "Sprint 1", "First sprint board")
        assert info.name == "Sprint 1"
        assert info.description == "First sprint board"
        assert info.id > 0

    def test_new_board_has_default_data(self) -> None:
        user, _ = register_user("ned", "pw12345")
        info = create_board(user.id, "Empty Board")
        result = get_board_by_id(info.id, user.id)
        assert result is not None
        board_data, _, _, _ = result
        assert len(board_data.columns) == 5


class TestGetBoardById:
    def test_get_own_board(self) -> None:
        user, _ = register_user("oliver", "pw12345")
        boards = list_boards(user.id)
        board_id = boards[0].id
        result = get_board_by_id(board_id, user.id)
        assert result is not None
        board_data, name, _, _ = result
        assert name == "My Board"
        assert len(board_data.columns) == 5

    def test_cannot_get_other_users_board(self) -> None:
        user1, _ = register_user("pat", "pw12345")
        user2, _ = register_user("quinn", "pw12345")
        boards1 = list_boards(user1.id)
        result = get_board_by_id(boards1[0].id, user2.id)
        assert result is None

    def test_nonexistent_board_returns_none(self) -> None:
        user, _ = register_user("rosa", "pw12345")
        assert get_board_by_id(9999, user.id) is None


class TestSaveBoardById:
    def test_save_updates_board_data(self) -> None:
        user, _ = register_user("sam", "pw12345")
        boards = list_boards(user.id)
        board_id = boards[0].id

        result = get_board_by_id(board_id, user.id)
        assert result is not None
        board_data, _, _, _ = result
        board_data.columns[0].title = "Renamed Column"

        save_board_by_id(board_id, user.id, board_data)
        updated = get_board_by_id(board_id, user.id)
        assert updated is not None
        assert updated[0].columns[0].title == "Renamed Column"

    def test_save_wrong_owner_raises(self) -> None:
        user1, _ = register_user("tina", "pw12345")
        user2, _ = register_user("uma", "pw12345")
        boards1 = list_boards(user1.id)
        board_data, _, _, _ = get_board_by_id(boards1[0].id, user1.id)
        with pytest.raises(ValueError):
            save_board_by_id(boards1[0].id, user2.id, board_data)


class TestUpdateBoardMeta:
    def test_rename_board(self) -> None:
        user, _ = register_user("vera", "pw12345")
        boards = list_boards(user.id)
        board_id = boards[0].id
        info = update_board_meta(board_id, user.id, name="Renamed", description=None)
        assert info.name == "Renamed"

    def test_update_description(self) -> None:
        user, _ = register_user("will", "pw12345")
        boards = list_boards(user.id)
        board_id = boards[0].id
        info = update_board_meta(board_id, user.id, name=None, description="New desc")
        assert info.description == "New desc"

    def test_update_wrong_owner_raises(self) -> None:
        user1, _ = register_user("xena", "pw12345")
        user2, _ = register_user("yuri", "pw12345")
        boards1 = list_boards(user1.id)
        with pytest.raises(ValueError):
            update_board_meta(boards1[0].id, user2.id, name="Hack", description=None)


class TestDeleteBoard:
    def test_delete_extra_board(self) -> None:
        user, _ = register_user("zara", "pw12345")
        info = create_board(user.id, "Board 2")
        delete_board(info.id, user.id)
        boards = list_boards(user.id)
        assert all(b.id != info.id for b in boards)

    def test_cannot_delete_only_board(self) -> None:
        user, _ = register_user("aaron", "pw12345")
        boards = list_boards(user.id)
        with pytest.raises(ValueError, match="only board"):
            delete_board(boards[0].id, user.id)

    def test_delete_wrong_owner_raises(self) -> None:
        user1, _ = register_user("bea", "pw12345")
        user2, _ = register_user("carl", "pw12345")
        info = create_board(user1.id, "Extra")
        with pytest.raises(ValueError):
            delete_board(info.id, user2.id)


class TestGetDefaultBoardId:
    def test_returns_first_board_id(self) -> None:
        user, _ = register_user("diana", "pw12345")
        boards = list_boards(user.id)
        default_id = get_default_board_id(user.id)
        assert default_id == boards[0].id

    def test_no_user_returns_none(self) -> None:
        assert get_default_board_id(99999) is None
