"""Tests for card search endpoint."""

import pytest
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_db(tmp_path, monkeypatch):
    monkeypatch.setenv("PM_DB_PATH", str(tmp_path / "test.db"))


def _register(username: str, password: str = "pw12345") -> dict:
    resp = client.post("/api/auth/register", json={"username": username, "password": password})
    assert resp.status_code == 200
    return resp.json()


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _get_default_board(token: str) -> dict:
    boards = client.get("/api/boards", headers=_auth(token)).json()["boards"]
    board_id = boards[0]["id"]
    return client.get(f"/api/boards/{board_id}", headers=_auth(token)).json()


def _save_board(token: str, board_id: int, board: dict) -> None:
    client.put(f"/api/boards/{board_id}", json={"board": board}, headers=_auth(token))


class TestSearchEndpoint:
    def test_empty_query_returns_empty(self) -> None:
        data = _register("searcher1")
        resp = client.get("/api/search?q=", headers=_auth(data["token"]))
        assert resp.status_code == 200
        assert resp.json() == {"results": [], "total": 0}

    def test_search_requires_auth(self) -> None:
        resp = client.get("/api/search?q=test")
        assert resp.status_code == 401

    def test_search_finds_card_by_title(self) -> None:
        data = _register("searcher2")
        token = data["token"]
        board_detail = _get_default_board(token)
        board_id = board_detail["id"]
        board = board_detail["board"]

        # Add a unique card
        board["cards"]["test-card-search"] = {
            "id": "test-card-search",
            "title": "UniqueSearchableTitleXYZ",
            "details": "Some details",
            "priority": None,
            "due_date": None,
            "labels": [],
        }
        board["columns"][0]["cardIds"].append("test-card-search")
        _save_board(token, board_id, board)

        resp = client.get("/api/search?q=UniqueSearchable", headers=_auth(token))
        assert resp.status_code == 200
        data_resp = resp.json()
        assert data_resp["total"] == 1
        assert data_resp["results"][0]["card_title"] == "UniqueSearchableTitleXYZ"

    def test_search_finds_card_by_details(self) -> None:
        data = _register("searcher3")
        token = data["token"]
        board_detail = _get_default_board(token)
        board_id = board_detail["id"]
        board = board_detail["board"]

        board["cards"]["details-card"] = {
            "id": "details-card",
            "title": "Generic Title",
            "details": "ContainsSpecialDetailsPhrase99",
            "priority": None,
            "due_date": None,
            "labels": [],
        }
        board["columns"][0]["cardIds"].append("details-card")
        _save_board(token, board_id, board)

        resp = client.get("/api/search?q=SpecialDetailsPhrase99", headers=_auth(token))
        assert resp.json()["total"] == 1

    def test_search_is_case_insensitive(self) -> None:
        data = _register("searcher4")
        token = data["token"]
        board_detail = _get_default_board(token)
        board_id = board_detail["id"]
        board = board_detail["board"]

        board["cards"]["ci-card"] = {
            "id": "ci-card",
            "title": "UPPERCASE TITLE",
            "details": "details",
            "priority": None,
            "due_date": None,
            "labels": [],
        }
        board["columns"][0]["cardIds"].append("ci-card")
        _save_board(token, board_id, board)

        resp = client.get("/api/search?q=uppercase", headers=_auth(token))
        assert resp.json()["total"] == 1

    def test_search_does_not_return_other_users_cards(self) -> None:
        d1 = _register("searcher5a")
        d2 = _register("searcher5b")

        # Add a unique card to user1's board
        board_detail = _get_default_board(d1["token"])
        board_id = board_detail["id"]
        board = board_detail["board"]
        board["cards"]["private-card"] = {
            "id": "private-card",
            "title": "PrivateCardForUser5A",
            "details": "private",
            "priority": None,
            "due_date": None,
            "labels": [],
        }
        board["columns"][0]["cardIds"].append("private-card")
        _save_board(d1["token"], board_id, board)

        # User2 should NOT find user1's card
        resp = client.get("/api/search?q=PrivateCardForUser5A", headers=_auth(d2["token"]))
        assert resp.json()["total"] == 0

    def test_search_across_multiple_boards(self) -> None:
        data = _register("searcher6")
        token = data["token"]

        # Create a second board
        create_resp = client.post("/api/boards", json={"name": "Board 2"}, headers=_auth(token))
        board2_id = create_resp.json()["id"]

        # Add a matching card to board 2
        board2 = client.get(f"/api/boards/{board2_id}", headers=_auth(token)).json()["board"]
        board2["cards"]["cross-board-card"] = {
            "id": "cross-board-card",
            "title": "CrossBoardSearchTarget",
            "details": "details",
            "priority": None,
            "due_date": None,
            "labels": [],
        }
        board2["columns"][0]["cardIds"].append("cross-board-card")
        _save_board(token, board2_id, board2)

        resp = client.get("/api/search?q=CrossBoardSearchTarget", headers=_auth(token))
        assert resp.json()["total"] == 1
        assert resp.json()["results"][0]["board_id"] == board2_id

    def test_search_includes_board_and_column_info(self) -> None:
        data = _register("searcher7")
        token = data["token"]
        board_detail = _get_default_board(token)
        board_id = board_detail["id"]
        board = board_detail["board"]

        board["cards"]["info-card"] = {
            "id": "info-card",
            "title": "InfoCardWithBoardName",
            "details": "some details",
            "priority": None,
            "due_date": None,
            "labels": [],
        }
        board["columns"][0]["cardIds"].append("info-card")
        _save_board(token, board_id, board)

        resp = client.get("/api/search?q=InfoCardWithBoardName", headers=_auth(token))
        result = resp.json()["results"][0]
        assert result["board_id"] == board_id
        assert result["board_name"] == "My Board"
        assert result["column_title"] != ""
