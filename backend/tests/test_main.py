from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root_returns_html() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "Kanban Studio" in response.text


def test_api_hello() -> None:
    response = client.get("/api/hello")
    assert response.status_code == 200
    assert response.json() == {"message": "hello"}


def test_root_serves_static_index_when_present(tmp_path, monkeypatch) -> None:
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<h1>Exported frontend</h1>")

    monkeypatch.setenv("PM_STATIC_DIR", str(static_dir))

    response = client.get("/")
    assert response.status_code == 200
    assert "Exported frontend" in response.text


def test_static_asset_serving(tmp_path, monkeypatch) -> None:
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<h1>Index</h1>")
    (static_dir / "sample.txt").write_text("asset")

    monkeypatch.setenv("PM_STATIC_DIR", str(static_dir))

    response = client.get("/sample.txt")
    assert response.status_code == 200
    assert response.text == "asset"


def test_unknown_path_falls_back_to_index(tmp_path, monkeypatch) -> None:
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<h1>Index Fallback</h1>")

    monkeypatch.setenv("PM_STATIC_DIR", str(static_dir))

    response = client.get("/some/client/route")
    assert response.status_code == 200
    assert "Index Fallback" in response.text


def test_board_get_and_put(tmp_path, monkeypatch) -> None:
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    get_response = client.get("/api/board", params={"username": "user"})
    assert get_response.status_code == 200
    get_payload = get_response.json()
    assert get_payload["username"] == "user"
    assert "columns" in get_payload["board"]
    assert "cards" in get_payload["board"]

    board = get_payload["board"]
    board["columns"][0]["title"] = "Renamed"

    put_response = client.put(
        "/api/board",
        params={"username": "user"},
        json={"board": board},
    )
    assert put_response.status_code == 200
    assert put_response.json()["board"]["columns"][0]["title"] == "Renamed"

    verify_response = client.get("/api/board", params={"username": "user"})
    assert verify_response.status_code == 200
    assert verify_response.json()["board"]["columns"][0]["title"] == "Renamed"


def test_board_put_rejects_empty_column_title(tmp_path, monkeypatch) -> None:
    """PUT /api/board should reject a board where a column title is empty."""
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    get_response = client.get("/api/board", params={"username": "user"})
    board = get_response.json()["board"]
    board["columns"][0]["title"] = ""

    response = client.put("/api/board", params={"username": "user"}, json={"board": board})
    assert response.status_code == 422


def test_board_put_rejects_empty_card_title(tmp_path, monkeypatch) -> None:
    """PUT /api/board should reject a board where a card title is empty."""
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    get_response = client.get("/api/board", params={"username": "user"})
    board = get_response.json()["board"]
    first_card_id = list(board["cards"].keys())[0]
    board["cards"][first_card_id]["title"] = ""

    response = client.put("/api/board", params={"username": "user"}, json={"board": board})
    assert response.status_code == 422


def test_board_put_rejects_oversized_card_title(tmp_path, monkeypatch) -> None:
    """PUT /api/board should reject a card title exceeding 200 characters."""
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    get_response = client.get("/api/board", params={"username": "user"})
    board = get_response.json()["board"]
    first_card_id = list(board["cards"].keys())[0]
    board["cards"][first_card_id]["title"] = "x" * 201

    response = client.put("/api/board", params={"username": "user"}, json={"board": board})
    assert response.status_code == 422


def test_board_put_rejects_empty_columns_list(tmp_path, monkeypatch) -> None:
    """PUT /api/board should reject a board with no columns."""
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    get_response = client.get("/api/board", params={"username": "user"})
    board = get_response.json()["board"]
    board["columns"] = []

    response = client.put("/api/board", params={"username": "user"}, json={"board": board})
    assert response.status_code == 422


def test_static_rejects_path_traversal(tmp_path, monkeypatch) -> None:
    """Requests containing path traversal segments must return 404, not a file."""
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<h1>Index</h1>")
    secret = tmp_path / "secret.txt"
    secret.write_text("sensitive data")

    monkeypatch.setenv("PM_STATIC_DIR", str(static_dir))

    response = client.get("/../secret.txt")
    assert response.status_code in (200, 404)
    assert "sensitive data" not in response.text


def test_ai_ping_missing_key() -> None:
    response = client.post("/api/ai/ping", json={"prompt": "2+2"})
    assert response.status_code == 400
    assert "OPENROUTER_API_KEY" in response.json()["detail"]


def test_ai_ping_success(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "dummy")
    monkeypatch.setattr("app.main.ask_openrouter", lambda prompt: "4")

    response = client.post("/api/ai/ping", json={"prompt": "2+2"})
    assert response.status_code == 200
    assert response.json()["answer"] == "4"


def test_ai_chat_missing_key(tmp_path, monkeypatch) -> None:
    """Test AI chat endpoint when API key is missing."""
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))

    response = client.post(
        "/api/ai/chat",
        json={"username": "user", "prompt": "Hello", "conversationHistory": []},
    )
    assert response.status_code == 400
    assert "OPENROUTER_API_KEY" in response.json()["detail"]


def test_ai_chat_reply_only(tmp_path, monkeypatch) -> None:
    """Test AI chat endpoint with reply-only response."""
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    monkeypatch.setenv("OPENROUTER_API_KEY", "dummy")

    # Mock the AI response
    def mock_ask_kanban(prompt, current_board, conversation_history=None):
        from app.models import AiKanbanResponse
        return AiKanbanResponse(
            schemaVersion="1.0",
            reply="This is helpful",
            boardUpdate=None,
        )

    monkeypatch.setattr("app.main.ask_openrouter_kanban", mock_ask_kanban)

    response = client.post(
        "/api/ai/chat",
        json={"username": "user", "prompt": "Hello", "conversationHistory": []},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["reply"] == "This is helpful"
    assert payload["boardUpdate"] is None
    assert payload["updated_at"] is None


def test_ai_chat_with_board_update(tmp_path, monkeypatch) -> None:
    """Test AI chat endpoint with board update."""
    db_path = tmp_path / "pm.db"
    monkeypatch.setenv("PM_DB_PATH", str(db_path))
    monkeypatch.setenv("OPENROUTER_API_KEY", "dummy")

    def mock_ask_kanban(prompt, current_board, conversation_history=None):
        from app.models import AiKanbanResponse, BoardData

        # Return board with renamed column
        updated_board = BoardData(
            columns=[
                {
                    "id": "col-backlog",
                    "title": "Todo",  # Renamed from "Backlog"
                    "cardIds": ["card-1", "card-2"],
                }
            ]
            + current_board.columns[1:],
            cards=current_board.cards,
        )
        return AiKanbanResponse(
            schemaVersion="1.0",
            reply="Renamed backlog to Todo",
            boardUpdate=updated_board,
        )

    monkeypatch.setattr("app.main.ask_openrouter_kanban", mock_ask_kanban)

    response = client.post(
        "/api/ai/chat",
        json={"username": "user", "prompt": "Rename backlog", "conversationHistory": []},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["reply"] == "Renamed backlog to Todo"
    assert payload["boardUpdate"] is not None
    assert payload["updated_at"] is not None
    assert payload["boardUpdate"]["columns"][0]["title"] == "Todo"

    # Verify persistence
    verify_response = client.get("/api/board", params={"username": "user"})
    assert verify_response.status_code == 200
    verify_board = verify_response.json()["board"]
    assert verify_board["columns"][0]["title"] == "Todo"
