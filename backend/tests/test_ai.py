"""Tests for backend/app/ai.py — OpenRouter integration."""

import json
from unittest.mock import MagicMock, patch

import httpx
import pytest

from app.ai import ask_openrouter, ask_openrouter_kanban
from app.db import DEFAULT_BOARD
from app.models import BoardData


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_board() -> BoardData:
    return BoardData.model_validate(DEFAULT_BOARD)


def _mock_httpx_response(content: str | dict, status_code: int = 200) -> MagicMock:
    """Build a fake httpx.Response that returns the given OpenRouter payload."""
    if isinstance(content, str):
        payload = content
    else:
        payload = json.dumps(content)

    mock_response = MagicMock(spec=httpx.Response)
    mock_response.status_code = status_code
    mock_response.json.return_value = {
        "choices": [{"message": {"content": payload}}]
    }
    mock_response.raise_for_status = MagicMock()
    return mock_response


def _openrouter_json(reply: str, board_update=None) -> dict:
    """Build a valid AI JSON payload."""
    return {
        "schemaVersion": "1.0",
        "reply": reply,
        "boardUpdate": board_update,
    }


# ---------------------------------------------------------------------------
# ask_openrouter — simple text endpoint
# ---------------------------------------------------------------------------


def test_ask_openrouter_raises_when_api_key_missing(monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        ask_openrouter("hello")


def test_ask_openrouter_returns_text_response(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_resp = _mock_httpx_response("4")

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        result = ask_openrouter("What is 2+2?")

    assert result == "4"


def test_ask_openrouter_raises_on_empty_choices(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {"choices": []}

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        with pytest.raises(RuntimeError, match="no choices"):
            ask_openrouter("hello")


def test_ask_openrouter_handles_list_content(monkeypatch) -> None:
    """Handles the multi-part content format some models return."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_resp = MagicMock(spec=httpx.Response)
    mock_resp.raise_for_status = MagicMock()
    mock_resp.json.return_value = {
        "choices": [{"message": {"content": [{"text": "Hello"}, {"text": " world"}]}}]
    }

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        result = ask_openrouter("hi")

    assert result == "Hello\n world"


# ---------------------------------------------------------------------------
# ask_openrouter_kanban — structured AI endpoint
# ---------------------------------------------------------------------------


def test_ask_openrouter_kanban_raises_when_api_key_missing(monkeypatch) -> None:
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        ask_openrouter_kanban("hi", _make_board())


def test_ask_openrouter_kanban_returns_reply_only(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    payload = _openrouter_json("Here is some advice.", board_update=None)
    mock_resp = _mock_httpx_response(payload)

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        result = ask_openrouter_kanban("Give me advice", _make_board())

    assert result.reply == "Here is some advice."
    assert result.boardUpdate is None


def test_ask_openrouter_kanban_returns_board_update(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board = _make_board()
    updated_board = board.model_dump()
    updated_board["columns"][0]["title"] = "Renamed"

    payload = _openrouter_json("Renamed backlog", board_update=updated_board)
    mock_resp = _mock_httpx_response(payload)

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        result = ask_openrouter_kanban("Rename backlog to Renamed", board)

    assert result.reply == "Renamed backlog"
    assert result.boardUpdate is not None
    assert result.boardUpdate.columns[0].title == "Renamed"


def test_ask_openrouter_kanban_raises_on_invalid_json(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    mock_resp = _mock_httpx_response("not json at all")

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        with pytest.raises(RuntimeError, match="not valid JSON"):
            ask_openrouter_kanban("hi", _make_board())


def test_ask_openrouter_kanban_raises_on_wrong_schema_version(monkeypatch) -> None:
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    payload = {"schemaVersion": "9.9", "reply": "hi", "boardUpdate": None}
    mock_resp = _mock_httpx_response(payload)

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        with pytest.raises(RuntimeError, match="validation failed"):
            ask_openrouter_kanban("hi", _make_board())


def test_ask_openrouter_kanban_rejects_new_columns(monkeypatch) -> None:
    """AI is not allowed to add new columns."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    board = _make_board()
    bad_board = board.model_dump()
    bad_board["columns"].append(
        {"id": "col-new", "title": "New Column", "cardIds": []}
    )

    payload = _openrouter_json("Added a column", board_update=bad_board)
    mock_resp = _mock_httpx_response(payload)

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        with pytest.raises(RuntimeError, match="[Vv]alidation failed"):
            ask_openrouter_kanban("Add a new column", board)


def test_ask_openrouter_kanban_passes_conversation_history(monkeypatch) -> None:
    """Verify that conversation history is forwarded to the API."""
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key")
    payload = _openrouter_json("Got it.")
    mock_resp = _mock_httpx_response(payload)

    history = [
        {"role": "user", "content": "Previous message"},
        {"role": "assistant", "content": "Previous reply"},
    ]

    with patch("httpx.Client") as mock_client_cls:
        mock_client = mock_client_cls.return_value.__enter__.return_value
        mock_client.post.return_value = mock_resp
        ask_openrouter_kanban("Follow-up", _make_board(), conversation_history=history)

        call_args = mock_client.post.call_args
        messages = call_args.kwargs["json"]["messages"]

    # System message + history + current user message
    roles = [m["role"] for m in messages]
    assert roles[0] == "system"
    assert any(m["content"] == "Previous message" for m in messages)
