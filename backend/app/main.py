import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from app.ai import MODEL_NAME, ask_openrouter, ask_openrouter_kanban
from app.db import get_board, init_db, save_board
from app.models import (
    AiChatRequest,
    AiChatResponse,
    AiPingRequest,
    AiPingResponse,
    BoardResponse,
    BoardUpdateRequest,
)

app = FastAPI(title="PM MVP Backend")


def load_root_env() -> None:
  env_path = Path(__file__).resolve().parent.parent.parent / ".env"
  if not env_path.exists():
    return

  for line in env_path.read_text().splitlines():
    stripped = line.strip()
    if not stripped or stripped.startswith("#") or "=" not in stripped:
      continue

    key, value = stripped.split("=", 1)
    os.environ.setdefault(key.strip(), value.strip())


@app.on_event("startup")
def startup() -> None:
  load_root_env()
  init_db()


def get_static_dir() -> Path:
  default_dir = Path(__file__).resolve().parent.parent / "static"
  configured_dir = os.getenv("PM_STATIC_DIR")
  if configured_dir:
    return Path(configured_dir)
  return default_dir


def find_static_file(requested_path: str) -> Path | None:
  static_dir = get_static_dir()
  if not static_dir.exists():
    return None

  normalized_path = requested_path.strip("/")
  if normalized_path == "":
    index_file = static_dir / "index.html"
    return index_file if index_file.exists() else None

  candidate = static_dir / normalized_path
  if candidate.is_file():
    return candidate

  nested_index = candidate / "index.html"
  if nested_index.exists():
    return nested_index

  return None


@app.get("/", response_class=HTMLResponse, response_model=None)
def read_root() -> HTMLResponse | FileResponse:
  static_index = find_static_file("")
  if static_index is not None:
    return FileResponse(static_index)

  return """
    <!doctype html>
    <html>
      <head>
        <meta charset=\"utf-8\" />
        <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\" />
        <title>PM MVP Backend</title>
      </head>
      <body style=\"font-family: sans-serif; padding: 2rem;\">
        <h1>Hello from FastAPI</h1>
        <p>Backend scaffold is running.</p>
        <p>Try <a href=\"/api/hello\">/api/hello</a>.</p>
      </body>
    </html>
    """


@app.get("/api/hello")
def read_hello() -> dict[str, str]:
    return {"message": "hello"}


@app.get("/api/board", response_model=BoardResponse)
def read_board(username: str = "user") -> BoardResponse:
  board, updated_at = get_board(username)
  return BoardResponse(username=username, board=board, updated_at=updated_at)


@app.put("/api/board", response_model=BoardResponse)
def update_board(request: BoardUpdateRequest, username: str = "user") -> BoardResponse:
  updated_at = save_board(username, request.board)
  return BoardResponse(username=username, board=request.board, updated_at=updated_at)


@app.post("/api/ai/ping", response_model=AiPingResponse)
def ai_ping(request: AiPingRequest) -> AiPingResponse:
  try:
    answer = ask_openrouter(request.prompt)
    return AiPingResponse(model=MODEL_NAME, answer=answer)
  except HTTPException:
    raise
  except Exception as error:
    raise HTTPException(status_code=400, detail=str(error)) from error


@app.post("/api/ai/chat", response_model=AiChatResponse)
def ai_chat(request: AiChatRequest) -> AiChatResponse:
  try:
    # Get current board state
    current_board, _ = get_board(request.username)
    
    # Request kanban-aware AI response
    ai_response = ask_openrouter_kanban(
        prompt=request.prompt,
        current_board=current_board,
        conversation_history=request.conversationHistory,
    )
    
    # If AI suggested board update, persist it
    updated_at = None
    if ai_response.boardUpdate:
      updated_at = save_board(request.username, ai_response.boardUpdate)
    
    return AiChatResponse(
        username=request.username,
        reply=ai_response.reply,
        boardUpdate=ai_response.boardUpdate,
        updated_at=updated_at,
    )
  except HTTPException:
    raise
  except Exception as error:
    raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/{requested_path:path}", response_model=None)
def serve_static_file(requested_path: str) -> FileResponse:
  if requested_path.startswith("api/"):
    raise HTTPException(status_code=404, detail="Not found")

  static_file = find_static_file(requested_path)
  if static_file is not None:
    return FileResponse(static_file)

  # Client-side route fallback for exported frontend.
  index_file = find_static_file("")
  if index_file is not None:
    return FileResponse(index_file)

  raise HTTPException(status_code=404, detail="Not found")
