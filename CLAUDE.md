# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack Kanban board MVP with an AI assistant. The frontend is a Next.js static export served by a FastAPI backend that integrates with OpenRouter for AI chat.

## Architecture

```
Browser (Next.js static export, port 8000)
  └─ KanbanBoard (drag-drop via @dnd-kit) + AiChat sidebar
       │ REST API
FastAPI (port 8000)
  ├─ GET/PUT /api/board?username=  — board persistence (SQLite)
  └─ POST /api/ai/chat             — AI with board context (OpenRouter)
       └─ SQLite (pm.db) + OpenRouter API (openai/gpt-oss-120b)
```

The frontend is built to `frontend/out/` and copied to `backend/static/` for production. In production, FastAPI serves the static files and the API — everything runs on port 8000.

**Key source files:**
- `frontend/src/components/KanbanBoard.tsx` — main component: auth, board state, drag-drop
- `frontend/src/components/AiChat.tsx` — AI chat sidebar component
- `frontend/src/lib/api.ts` — API client for board and AI endpoints
- `frontend/src/lib/auth.ts` — session-based auth (hardcoded credentials)
- `frontend/src/lib/kanban.ts` — board utility logic (column/card helpers)
- `backend/app/main.py` — all FastAPI routes
- `backend/app/ai.py` — OpenRouter integration and kanban-aware prompting
- `backend/app/ai_validation.py` — JSON schema validation for AI responses
- `backend/app/db.py` — SQLite operations

**Environment:** Requires `OPENROUTER_API_KEY` in `.env` at project root. Optional: `PM_DB_PATH` (default: `backend/data/pm.db`), `PM_STATIC_DIR` (default: `backend/static`).

## Development Commands

### Frontend (from `frontend/`)
```bash
npm install
npm run dev          # Dev server (standalone, no backend)
npm run build        # Static export to frontend/out/
npm run lint         # ESLint
npm run test         # Vitest unit tests (run once)
npm run test:watch   # Vitest in watch mode
npm run test:e2e     # Playwright E2E tests
```

### Backend (from `backend/`)
```bash
python3 -m venv .venv && source .venv/bin/activate
pip install -e .     # Install from pyproject.toml
uvicorn app.main:app --reload --port 8000

# Run tests
python -m pytest tests/ -v
python -m pytest tests/test_main.py::test_name -v   # Single test
```

### Full production build
```bash
cd frontend && npm run build
rm -rf ../backend/static && cp -r out ../backend/static
cd ../backend && uvicorn app.main:app --port 8000
# Visit http://127.0.0.1:8000
```

### Docker (cross-platform scripts)
```bash
./scripts/start-linux.sh    # Build and run Docker container
./scripts/stop-linux.sh     # Stop container
```

## Data Models

Board state is a `BoardData` object (see `backend/app/models.py`):
- Columns are ordered lists with a `status` field used as the Kanban lane identifier
- Cards have `id`, `title`, `details` (not `description`)
- Board state is persisted per-username in SQLite

## AI Integration

The AI chat endpoint (`POST /api/ai/chat`) receives the full board state as context and returns structured JSON that may include board mutation commands (add/move/update cards). Responses are validated against a schema in `ai_validation.py`. See `docs/AI_SCHEMA.md` for the response format spec.

**Constraints:** AI cannot create new columns — the 5 fixed columns (Backlog, Discovery, In Progress, Review, Done) are enforced by `validate_board_update()`. Conversation history is capped at 10 messages.

**Dev login credentials:** username `user`, password `password` (hardcoded in `auth.ts`).

## Testing Notes

- Backend tests use `httpx.AsyncClient` with FastAPI's `ASGITransport` — no real network calls
- Frontend unit tests use Vitest + jsdom; component tests exist for `KanbanBoard` and `AiChat`; E2E uses Playwright
- AI responses in tests use fixture JSON matching the schema in `docs/AI_SCHEMA.md`
- Backend test files are split by module: `test_main.py`, `test_ai.py`, `test_ai_validation.py`, `test_db.py`



