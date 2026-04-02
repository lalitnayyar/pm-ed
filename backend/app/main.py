import os
from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import FileResponse, HTMLResponse

from app.ai import MODEL_NAME, ask_openrouter, ask_openrouter_kanban
from app.db import (
    create_board,
    delete_board,
    get_activity_log,
    get_board,
    get_board_by_id,
    get_default_board_id,
    get_user_by_token,
    list_boards,
    log_activity,
    login_user,
    logout_user,
    register_user,
    save_board,
    save_board_by_id,
    search_cards,
    update_board_meta,
    update_user_profile,
    init_db,
)
from app.models import (
    ActivityLogResponse,
    AiChatRequest,
    AiChatResponse,
    AiPingRequest,
    AiPingResponse,
    AuthResponse,
    BoardDetailResponse,
    BoardListResponse,
    BoardResponse,
    BoardUpdateRequest,
    CreateBoardRequest,
    SearchResponse,
    UpdateBoardMetaRequest,
    UpdateBoardRequest,
    UpdateProfileRequest,
    UserCreate,
    UserLogin,
    UserResponse,
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
    try:
        candidate.resolve().relative_to(static_dir.resolve())
    except ValueError:
        return None

    if candidate.is_file():
        return candidate

    nested_index = candidate / "index.html"
    if nested_index.exists():
        return nested_index

    return None


# ── Auth dependency ───────────────────────────────────────────────────────────

def get_current_user(request: Request) -> UserResponse:
    """Extract Bearer token from Authorization header and return the user."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization token")
    token = auth_header[len("Bearer "):]
    user = get_user_by_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return user


# ── Static serving ────────────────────────────────────────────────────────────

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


# ── Auth endpoints ────────────────────────────────────────────────────────────

@app.post("/api/auth/register", response_model=AuthResponse)
def auth_register(payload: UserCreate) -> AuthResponse:
    try:
        user, token = register_user(payload.username, payload.password, payload.email)
        return AuthResponse(token=token, user=user)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error


@app.post("/api/auth/login", response_model=AuthResponse)
def auth_login(payload: UserLogin) -> AuthResponse:
    try:
        user, token = login_user(payload.username, payload.password)
        return AuthResponse(token=token, user=user)
    except ValueError as error:
        raise HTTPException(status_code=401, detail=str(error)) from error


@app.post("/api/auth/logout", status_code=204)
def auth_logout(request: Request) -> None:
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer "):]
        logout_user(token)


@app.get("/api/users/me", response_model=UserResponse)
def get_me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user


@app.patch("/api/users/me", response_model=UserResponse)
def patch_me(
    payload: UpdateProfileRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> UserResponse:
    try:
        return update_user_profile(
            current_user.id,
            email=payload.email,
            current_password=payload.current_password,
            new_password=payload.new_password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


# ── Multi-board endpoints ─────────────────────────────────────────────────────

@app.get("/api/boards", response_model=BoardListResponse)
def get_boards(current_user: UserResponse = Depends(get_current_user)) -> BoardListResponse:
    boards = list_boards(current_user.id)
    return BoardListResponse(boards=boards)


@app.post("/api/boards", response_model=BoardDetailResponse)
def post_boards(
    payload: CreateBoardRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> BoardDetailResponse:
    info = create_board(current_user.id, payload.name, payload.description)
    result = get_board_by_id(info.id, current_user.id)
    if not result:
        raise HTTPException(status_code=500, detail="Board creation failed")
    board_data, name, description, updated_at = result
    return BoardDetailResponse(
        id=info.id,
        name=name,
        description=description,
        board=board_data,
        updated_at=updated_at,
    )


@app.get("/api/boards/{board_id}", response_model=BoardDetailResponse)
def get_board_detail(
    board_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> BoardDetailResponse:
    result = get_board_by_id(board_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Board not found")
    board_data, name, description, updated_at = result
    return BoardDetailResponse(
        id=board_id,
        name=name,
        description=description,
        board=board_data,
        updated_at=updated_at,
    )


@app.put("/api/boards/{board_id}", response_model=BoardDetailResponse)
def put_board_detail(
    board_id: int,
    payload: UpdateBoardRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> BoardDetailResponse:
    try:
        updated_at = save_board_by_id(board_id, current_user.id, payload.board)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    log_activity(board_id, current_user.id, "updated board", "")

    result = get_board_by_id(board_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Board not found")
    board_data, name, description, _ = result
    return BoardDetailResponse(
        id=board_id,
        name=name,
        description=description,
        board=board_data,
        updated_at=updated_at,
    )


@app.patch("/api/boards/{board_id}", response_model=BoardDetailResponse)
def patch_board_meta(
    board_id: int,
    payload: UpdateBoardMetaRequest,
    current_user: UserResponse = Depends(get_current_user),
) -> BoardDetailResponse:
    try:
        info = update_board_meta(board_id, current_user.id, payload.name, payload.description)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error

    if payload.name is not None:
        log_activity(board_id, current_user.id, "renamed board", info.name)

    result = get_board_by_id(board_id, current_user.id)
    if not result:
        raise HTTPException(status_code=404, detail="Board not found")
    board_data, name, description, updated_at = result
    return BoardDetailResponse(
        id=board_id,
        name=name,
        description=description,
        board=board_data,
        updated_at=updated_at,
    )


@app.delete("/api/boards/{board_id}", status_code=204)
def remove_board(
    board_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> None:
    try:
        delete_board(board_id, current_user.id)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error


@app.get("/api/boards/{board_id}/activity", response_model=ActivityLogResponse)
def get_board_activity(
    board_id: int,
    current_user: UserResponse = Depends(get_current_user),
) -> ActivityLogResponse:
    try:
        entries = get_activity_log(board_id, current_user.id)
        return ActivityLogResponse(entries=entries)
    except ValueError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/search", response_model=SearchResponse)
def search_endpoint(
    q: str = "",
    current_user: UserResponse = Depends(get_current_user),
) -> SearchResponse:
    if not q.strip():
        return SearchResponse(results=[], total=0)
    results = search_cards(current_user.id, q)
    return SearchResponse(results=results, total=len(results))


# ── Legacy board endpoints (backward-compat) ──────────────────────────────────

@app.get("/api/board", response_model=BoardResponse)
def read_board(username: str = "user") -> BoardResponse:
    board, updated_at = get_board(username)
    return BoardResponse(username=username, board=board, updated_at=updated_at)


@app.put("/api/board", response_model=BoardResponse)
def update_board(request: BoardUpdateRequest, username: str = "user") -> BoardResponse:
    updated_at = save_board(username, request.board)
    return BoardResponse(username=username, board=request.board, updated_at=updated_at)


# ── AI endpoints ──────────────────────────────────────────────────────────────

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


# ── Static file catch-all ─────────────────────────────────────────────────────

@app.get("/{requested_path:path}", response_model=None)
def serve_static_file(requested_path: str) -> FileResponse:
    if requested_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    static_file = find_static_file(requested_path)
    if static_file is not None:
        return FileResponse(static_file)

    index_file = find_static_file("")
    if index_file is not None:
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Not found")
