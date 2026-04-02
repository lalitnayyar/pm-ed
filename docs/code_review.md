# Code Review

Reviewed the current source tree against the MVP requirements in `AGENTS.md` and `docs/PLAN.md`.
Generated artifacts and vendor directories were treated as out of scope: `.git`, `node_modules`, `.next`, `frontend/out`, `backend/static`, `.venv`, `.pytest_cache`, and `backend/data/pm.db`.

## Findings

1. critical - `scripts/start-linux.sh:17`, `scripts/start-mac.sh:17`, `scripts/start-windows.ps1:17`: all Docker start scripts run the app container without a persistent volume for `/app/backend/data` and without loading the root `.env` file. Because each script also force-removes any existing container before starting a new one, the SQLite database is lost on every restart and `OPENROUTER_API_KEY` is unavailable in Docker, so both persistence and AI chat fail in the primary containerized flow.

2. critical - `frontend/src/components/KanbanBoard.tsx:31-39`, `frontend/src/components/KanbanBoard.tsx:145-151`, `frontend/src/components/KanbanBoard.tsx:345-350`, `frontend/src/components/AiChat.tsx:67-74`: the app restores only `isAuthenticated` after refresh, not the signed-in username, but still passes the `username` state into AI chat requests. After a reload, AI requests are sent as `""`, so the backend loads or creates a separate board for the empty username while normal board saves still default to `user`; when an AI board update is applied, the frontend saves that mismatched board back onto the real `user` board, which can overwrite the user's data with the wrong board state.

3. high - `backend/app/ai_validation.py:72-81`, `backend/tests/test_ai_validation.py:162-173`: AI board-update validation only rejects new column IDs and explicitly allows existing columns to be omitted. That breaks the stated requirement that columns are fixed and only renamable, so an AI response can silently delete stages from the board and the test suite currently codifies that incorrect behavior.

4. low - `frontend/src/components/AiChat.tsx:13-27` and `frontend/src/components/AiChat.test.tsx:1`: the frontend keeps an unused `currentBoard` prop and an unused `within` import in the AI chat tests. This does not break behavior, but it leaves avoidable lint warnings in the main frontend quality check.

5. low - `backend/app/main.py:35-38`: FastAPI startup still uses `@app.on_event("startup")`, which now emits a deprecation warning in the backend test suite. It is not breaking today, but it is technical debt in a core app lifecycle path and should be migrated to a lifespan handler before the framework removes the old hook.

## Check Results

- `frontend: npm run lint` - completed with 2 warnings: unused `currentBoard` prop in `frontend/src/components/AiChat.tsx` and unused `within` import in `frontend/src/components/AiChat.test.tsx`.
- `frontend: npm run test` - passed, 27 tests.
- `frontend: npm run build` - passed.
- `backend: .venv/bin/python -m pytest` - passed, 60 tests.
- `backend` tests emitted 2 deprecation warnings from FastAPI's `on_event` startup hook.

## Conclusion

The project is in reasonable shape overall: the frontend builds, the automated frontend and backend tests pass, and the main MVP architecture is present. The biggest risks are both in user-critical flows: the shipped Docker start scripts do not preserve state or inject AI configuration, and the AI chat path can overwrite the signed-in user's board after a page reload because username handling is inconsistent. Those two issues should be fixed before relying on the Docker workflow or the AI-assisted board editing flow.
