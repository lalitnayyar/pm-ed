# Backend Guide

## Purpose

The backend hosts a FastAPI app for the PM MVP and will evolve to serve the frontend and Kanban APIs.

## Current Scope (Part 2)

- Provides a static hello HTML page at `/` when no built frontend is present.
- Provides an API hello endpoint at `/api/hello`.
- Serves built frontend static files from `backend/static` when available.
- Includes baseline backend tests.

## Key Files

- `app/main.py`: FastAPI app and routes.
- `tests/test_main.py`: Route tests.
- `pyproject.toml`: Dependencies and test settings.
- `README.md`: Run and test commands.
- `../Dockerfile`: Multi-stage build for frontend static export + backend runtime.

## Run

```bash
uv run uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

## Tests

```bash
uv run --directory backend pytest
```