"""Tests for auth endpoints and multi-board API routes."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "test.db"))


def _register(username: str = "alice", password: str = "pw12345") -> dict:
    """Helper: register a user and return the auth response payload."""
    resp = client.post("/api/auth/register", json={"username": username, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()


def _auth_headers(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ── Register ──────────────────────────────────────────────────────────────────

class TestRegisterEndpoint:
    def test_register_returns_token_and_user(self) -> None:
        resp = client.post("/api/auth/register", json={"username": "bob", "password": "pw12345"})
        assert resp.status_code == 200
        payload = resp.json()
        assert "token" in payload
        assert payload["user"]["username"] == "bob"
        assert payload["user"]["id"] > 0

    def test_register_duplicate_username_returns_409(self) -> None:
        _register("charlie")
        resp = client.post("/api/auth/register", json={"username": "charlie", "password": "pw12345"})
        assert resp.status_code == 409

    def test_register_short_password_returns_422(self) -> None:
        resp = client.post("/api/auth/register", json={"username": "dana", "password": "123"})
        assert resp.status_code == 422

    def test_register_short_username_returns_422(self) -> None:
        resp = client.post("/api/auth/register", json={"username": "a", "password": "pw12345"})
        assert resp.status_code == 422

    def test_register_with_email(self) -> None:
        resp = client.post(
            "/api/auth/register",
            json={"username": "eve", "password": "pw12345", "email": "eve@example.com"},
        )
        assert resp.status_code == 200
        assert resp.json()["user"]["email"] == "eve@example.com"


# ── Login ─────────────────────────────────────────────────────────────────────

class TestLoginEndpoint:
    def test_login_valid_credentials(self) -> None:
        _register("frank")
        resp = client.post("/api/auth/login", json={"username": "frank", "password": "pw12345"})
        assert resp.status_code == 200
        assert "token" in resp.json()

    def test_login_wrong_password_returns_401(self) -> None:
        _register("grace")
        resp = client.post("/api/auth/login", json={"username": "grace", "password": "wrong"})
        assert resp.status_code == 401

    def test_login_unknown_user_returns_401(self) -> None:
        resp = client.post("/api/auth/login", json={"username": "nobody", "password": "pw"})
        assert resp.status_code == 401

    def test_default_demo_user_login(self) -> None:
        """The seeded demo user 'user'/'password' should always be loginable."""
        resp = client.post("/api/auth/login", json={"username": "user", "password": "password"})
        assert resp.status_code == 200
        assert resp.json()["user"]["username"] == "user"


# ── Logout ────────────────────────────────────────────────────────────────────

class TestLogoutEndpoint:
    def test_logout_returns_204(self) -> None:
        data = _register("heidi")
        resp = client.post("/api/auth/logout", headers=_auth_headers(data["token"]))
        assert resp.status_code == 204

    def test_logout_invalidates_token(self) -> None:
        data = _register("ivan")
        token = data["token"]
        client.post("/api/auth/logout", headers=_auth_headers(token))
        me_resp = client.get("/api/users/me", headers=_auth_headers(token))
        assert me_resp.status_code == 401

    def test_logout_no_token_returns_204(self) -> None:
        """Logout without token is a no-op, still 204."""
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 204


# ── /api/users/me ─────────────────────────────────────────────────────────────

class TestGetMeEndpoint:
    def test_me_returns_user_info(self) -> None:
        data = _register("judy")
        resp = client.get("/api/users/me", headers=_auth_headers(data["token"]))
        assert resp.status_code == 200
        assert resp.json()["username"] == "judy"

    def test_me_without_token_returns_401(self) -> None:
        resp = client.get("/api/users/me")
        assert resp.status_code == 401

    def test_me_with_invalid_token_returns_401(self) -> None:
        resp = client.get("/api/users/me", headers={"Authorization": "Bearer bogus"})
        assert resp.status_code == 401


# ── GET /api/boards ───────────────────────────────────────────────────────────

class TestGetBoardsList:
    def test_returns_boards_for_user(self) -> None:
        data = _register("kim")
        resp = client.get("/api/boards", headers=_auth_headers(data["token"]))
        assert resp.status_code == 200
        boards = resp.json()["boards"]
        assert len(boards) == 1
        assert boards[0]["name"] == "My Board"

    def test_requires_auth(self) -> None:
        resp = client.get("/api/boards")
        assert resp.status_code == 401


# ── POST /api/boards ──────────────────────────────────────────────────────────

class TestCreateBoardEndpoint:
    def test_create_board_returns_detail(self) -> None:
        data = _register("leo")
        resp = client.post(
            "/api/boards",
            json={"name": "Sprint 1", "description": "First sprint"},
            headers=_auth_headers(data["token"]),
        )
        assert resp.status_code == 200
        payload = resp.json()
        assert payload["name"] == "Sprint 1"
        assert payload["description"] == "First sprint"
        assert "board" in payload
        assert len(payload["board"]["columns"]) == 5

    def test_create_board_appears_in_list(self) -> None:
        data = _register("meg")
        client.post("/api/boards", json={"name": "Board 2"}, headers=_auth_headers(data["token"]))
        list_resp = client.get("/api/boards", headers=_auth_headers(data["token"]))
        names = [b["name"] for b in list_resp.json()["boards"]]
        assert "Board 2" in names

    def test_create_board_requires_auth(self) -> None:
        resp = client.post("/api/boards", json={"name": "X"})
        assert resp.status_code == 401

    def test_create_board_empty_name_returns_422(self) -> None:
        data = _register("ned")
        resp = client.post("/api/boards", json={"name": ""}, headers=_auth_headers(data["token"]))
        assert resp.status_code == 422


# ── GET /api/boards/{id} ──────────────────────────────────────────────────────

class TestGetBoardDetail:
    def test_get_own_board(self) -> None:
        data = _register("oliver")
        boards = client.get("/api/boards", headers=_auth_headers(data["token"])).json()["boards"]
        board_id = boards[0]["id"]
        resp = client.get(f"/api/boards/{board_id}", headers=_auth_headers(data["token"]))
        assert resp.status_code == 200
        assert resp.json()["id"] == board_id

    def test_cannot_get_other_users_board(self) -> None:
        data1 = _register("pat")
        data2 = _register("quinn")
        boards1 = client.get("/api/boards", headers=_auth_headers(data1["token"])).json()["boards"]
        board_id = boards1[0]["id"]
        resp = client.get(f"/api/boards/{board_id}", headers=_auth_headers(data2["token"]))
        assert resp.status_code == 404

    def test_nonexistent_board_returns_404(self) -> None:
        data = _register("rosa")
        resp = client.get("/api/boards/9999", headers=_auth_headers(data["token"]))
        assert resp.status_code == 404


# ── PUT /api/boards/{id} ──────────────────────────────────────────────────────

class TestUpdateBoard:
    def test_put_updates_board_data(self) -> None:
        data = _register("sam")
        boards = client.get("/api/boards", headers=_auth_headers(data["token"])).json()["boards"]
        board_id = boards[0]["id"]

        board_resp = client.get(f"/api/boards/{board_id}", headers=_auth_headers(data["token"]))
        board = board_resp.json()["board"]
        board["columns"][0]["title"] = "My Custom Column"

        resp = client.put(
            f"/api/boards/{board_id}",
            json={"board": board},
            headers=_auth_headers(data["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["board"]["columns"][0]["title"] == "My Custom Column"

    def test_put_persists_across_requests(self) -> None:
        data = _register("tina")
        boards = client.get("/api/boards", headers=_auth_headers(data["token"])).json()["boards"]
        board_id = boards[0]["id"]

        board = client.get(f"/api/boards/{board_id}", headers=_auth_headers(data["token"])).json()["board"]
        board["columns"][0]["title"] = "Persisted"
        client.put(f"/api/boards/{board_id}", json={"board": board}, headers=_auth_headers(data["token"]))

        verify = client.get(f"/api/boards/{board_id}", headers=_auth_headers(data["token"]))
        assert verify.json()["board"]["columns"][0]["title"] == "Persisted"

    def test_put_with_card_priority_and_due_date(self) -> None:
        data = _register("uma")
        boards = client.get("/api/boards", headers=_auth_headers(data["token"])).json()["boards"]
        board_id = boards[0]["id"]

        board = client.get(f"/api/boards/{board_id}", headers=_auth_headers(data["token"])).json()["board"]
        first_card_id = list(board["cards"].keys())[0]
        board["cards"][first_card_id]["priority"] = "high"
        board["cards"][first_card_id]["due_date"] = "2026-06-01"

        resp = client.put(f"/api/boards/{board_id}", json={"board": board}, headers=_auth_headers(data["token"]))
        assert resp.status_code == 200
        saved_card = resp.json()["board"]["cards"][first_card_id]
        assert saved_card["priority"] == "high"
        assert saved_card["due_date"] == "2026-06-01"


# ── PATCH /api/boards/{id} ────────────────────────────────────────────────────

class TestPatchBoardMeta:
    def test_rename_board(self) -> None:
        data = _register("vera")
        boards = client.get("/api/boards", headers=_auth_headers(data["token"])).json()["boards"]
        board_id = boards[0]["id"]

        resp = client.patch(
            f"/api/boards/{board_id}",
            json={"name": "Renamed Board"},
            headers=_auth_headers(data["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Renamed Board"

    def test_update_description(self) -> None:
        data = _register("will")
        boards = client.get("/api/boards", headers=_auth_headers(data["token"])).json()["boards"]
        board_id = boards[0]["id"]

        resp = client.patch(
            f"/api/boards/{board_id}",
            json={"description": "My sprint board"},
            headers=_auth_headers(data["token"]),
        )
        assert resp.status_code == 200
        assert resp.json()["description"] == "My sprint board"


# ── DELETE /api/boards/{id} ───────────────────────────────────────────────────

class TestDeleteBoard:
    def test_delete_extra_board_returns_204(self) -> None:
        data = _register("xena")
        create_resp = client.post(
            "/api/boards", json={"name": "Board 2"}, headers=_auth_headers(data["token"])
        )
        board_id = create_resp.json()["id"]

        resp = client.delete(f"/api/boards/{board_id}", headers=_auth_headers(data["token"]))
        assert resp.status_code == 204

        list_resp = client.get("/api/boards", headers=_auth_headers(data["token"]))
        ids = [b["id"] for b in list_resp.json()["boards"]]
        assert board_id not in ids

    def test_cannot_delete_only_board(self) -> None:
        data = _register("yuri")
        boards = client.get("/api/boards", headers=_auth_headers(data["token"])).json()["boards"]
        board_id = boards[0]["id"]

        resp = client.delete(f"/api/boards/{board_id}", headers=_auth_headers(data["token"]))
        assert resp.status_code == 400

    def test_cannot_delete_other_users_board(self) -> None:
        data1 = _register("zara")
        data2 = _register("adam")
        create_resp = client.post(
            "/api/boards", json={"name": "Board 2"}, headers=_auth_headers(data1["token"])
        )
        board_id = create_resp.json()["id"]

        resp = client.delete(f"/api/boards/{board_id}", headers=_auth_headers(data2["token"]))
        assert resp.status_code == 400
