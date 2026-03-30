# Code Review Report

**Date:** 2026-03-26
**Scope:** Full repository — backend, frontend, tests, infrastructure
**Reviewer:** Claude Code (claude-sonnet-4-6)

---

## Summary

The MVP is well-structured and functionally complete. Architecture decisions are appropriate for the scope. The main categories of issues are:

1. **Security gaps** — path traversal in static file serving; hardcoded client-side credentials
2. **Bugs** — hardcoded `"user"` literal passed to `AiChat` ignores the actual logged-in username
3. **Reliability gaps** — silent save failures, no fetch timeout, no retry
4. **Test coverage gaps** — `db.py` and `ai.py` are untested; no E2E coverage of AI chat
5. **Code quality** — deprecated FastAPI lifecycle API; weak ID generation; duplicated default board data

Issues marked **[MVP-BY-DESIGN]** are known trade-offs for this demo scope but must be addressed before production.

---

## Backend

### `backend/app/main.py`

#### BUG — Path traversal in `find_static_file()` (lines 49–67)

`Path(static_dir) / normalized_path` does not prevent `..` segments. A request for `GET /../../etc/passwd` would cause `candidate` to resolve outside `static_dir`.

```python
# current — vulnerable
candidate = static_dir / normalized_path
if candidate.is_file():
    return candidate
```

**Fix:** Validate the resolved path stays within `static_dir`:

```python
candidate = static_dir / normalized_path
try:
    candidate.resolve().relative_to(static_dir.resolve())
except ValueError:
    return None
if candidate.is_file():
    return candidate
```

#### LOW — Deprecated `@app.on_event("startup")` (line 35)

FastAPI emits a deprecation warning on every startup. Should migrate to the `lifespan` context manager pattern.

```python
# current — deprecated
@app.on_event("startup")
def startup() -> None: ...

# fix
from contextlib import asynccontextmanager
@asynccontextmanager
async def lifespan(app: FastAPI):
    load_root_env()
    init_db()
    yield

app = FastAPI(title="PM MVP Backend", lifespan=lifespan)
```

#### LOW — Generic exception → 400 for all errors (lines 117–118, 147–148)

All non-HTTP exceptions become `400 Bad Request` regardless of whether the cause was a timeout, internal error, or bad input. Timeouts should be `504`, internal errors `500`.

---

### `backend/app/ai.py`

#### BUG — No timeout on the `httpx` call

`httpx.post()` is called without a `timeout` argument. If OpenRouter hangs, the request hangs indefinitely. The 30-second timeout referenced in docs is not present in the actual code — confirm it is applied via the `httpx` client configuration and add it explicitly if not.

**Fix:** Pass `timeout=30.0` directly on the call or via `httpx.Client(timeout=30.0)`.

#### LOW — Hardcoded model name (line 11)

`MODEL_NAME = "openai/gpt-oss-120b"` cannot be changed without a code edit. Move to an env var:

```python
MODEL_NAME = os.getenv("AI_MODEL", "openai/gpt-oss-120b")
```

---

### `backend/app/db.py`

#### MEDIUM — `init_db()` called on every `get_board()` read

`get_board()` calls `init_db()` to ensure tables exist. This runs DDL on every read. Move the guard to startup only (already done via `startup()`) and remove the call from `get_board()`.

#### LOW — Default board duplicated between `db.py` and `kanban.ts`

Both files define the same default 5-column, 8-card board independently. Any content change requires editing two places. Consider exporting a shared JSON file or generating one at build time.

---

### `backend/app/models.py`

#### LOW — No field-level validation in Pydantic models

`Card.title`, `Card.details`, and `Column.title` have no length or non-empty constraints in the Pydantic models. Validation happens only in `ai_validation.py` for AI responses but is absent for direct API `PUT /api/board` calls. A client can store empty card titles or 10 MB detail strings via the board API.

**Fix:** Add Pydantic `Field` constraints:

```python
from pydantic import Field

class Card(BaseModel):
    id: str
    title: str = Field(min_length=1, max_length=200)
    details: str = Field(min_length=1, max_length=1000)
```

---

## Frontend

### `frontend/src/components/KanbanBoard.tsx`

#### BUG — Hardcoded `username="user"` passed to `AiChat` (line 344)

The component tracks `username` as state (line 31), but the `AiChat` component receives the literal string `"user"`:

```tsx
// line 344 — bug
<AiChat ... username="user" />

// fix — pass the state variable
<AiChat ... username={username} />
```

This means AI chat requests would always use `"user"` even if the system is extended to support multiple accounts.

#### MEDIUM — Silent `saveBoard` failure (lines 74–76)

When `saveBoard()` throws, the error is swallowed:

```tsx
void saveBoard(next).catch(() => {
  // Keep UI responsive when backend is unreachable.
});
```

The user sees no indication that their change did not persist. This is fine for momentary outages, but a persistent failure (bad network, server down) leaves the board looking saved when it isn't.

**Fix:** Track consecutive save failures and show a non-blocking banner after 2+ failures.

#### LOW — [MVP-BY-DESIGN] Client-side only authentication

`auth.ts` validates credentials entirely in the browser against hardcoded constants. There is no server-side verification. Bypassing the login page (e.g., setting `pm-authenticated=true` in localStorage) grants full board access. This is understood for MVP but is the primary security gap to address before production.

---

### `frontend/src/components/AiChat.tsx`

#### MEDIUM — No fetch timeout (line ~64)

The `fetch("/api/ai/chat", ...)` call has no `AbortController` timeout. If the backend hangs, the loading spinner runs indefinitely.

**Fix:**

```typescript
const controller = new AbortController();
const timeoutId = setTimeout(() => controller.abort(), 60_000);
try {
  const res = await fetch("/api/ai/chat", {
    ...options,
    signal: controller.signal,
  });
} finally {
  clearTimeout(timeoutId);
}
```

#### LOW — `Date.now()` for message IDs (lines ~46, 82, 100)

Two messages submitted within 1ms would get the same ID, causing React key collisions. Use `crypto.randomUUID()` instead:

```typescript
// current
id: `msg-user-${Date.now()}`

// fix
id: `msg-user-${crypto.randomUUID()}`
```

---

### `frontend/src/lib/auth.ts`

#### LOW — [MVP-BY-DESIGN] Credentials visible in source (lines 1–2)

`AUTH_USERNAME = "user"` and `AUTH_PASSWORD = "password"` are in the compiled JavaScript bundle. Anyone who loads the page can read them. Acceptable for demo; requires server-side auth for production.

---

### `frontend/src/lib/kanban.ts`

#### LOW — Weak card ID generation (`createId()`)

Uses `Math.random().toString(36)` which is not cryptographically random. In a multi-user or concurrent context this could produce collisions. Replace with `crypto.randomUUID()`:

```typescript
// current
const createId = (): string =>
  `card-${Math.random().toString(36).slice(2, 8)}`;

// fix
const createId = (): string => `card-${crypto.randomUUID()}`;
```

---

### `frontend/src/lib/api.ts`

#### LOW — No runtime response validation

API responses are cast directly to TypeScript types with no runtime check. If the backend returns an unexpected shape, the app fails silently or with a confusing error. Consider adding basic structural validation (e.g., checking that `columns` is an array) after parsing.

---

## Tests

### Backend

#### HIGH — `backend/app/db.py` has zero test coverage

None of the database functions (`init_db`, `get_board`, `save_board`, `get_or_create_user`) are tested. This is the most critical untested path — it handles schema creation, data seeding, and board persistence.

**Minimum coverage needed:**
- `get_board()` returns default board for new user
- `save_board()` persists data that survives a new connection
- `init_db()` is idempotent (safe to call twice)

#### HIGH — `backend/app/ai.py` has zero test coverage

`ask_openrouter()` and `ask_openrouter_kanban()` are not directly tested. Only tested indirectly via `test_main.py` with mocked responses. Direct unit tests would catch prompt construction bugs and response parsing edge cases.

#### MEDIUM — `PUT /api/board` not tested for invalid payloads

`test_main.py` tests the happy path for the board API but has no tests for:
- Missing required fields
- Empty `columns` array
- Card IDs referenced in columns that don't exist in `cards`

These would all currently return 422 from Pydantic — worth asserting explicitly.

### Frontend

#### MEDIUM — No E2E test for AI chat

`tests/kanban.spec.ts` has 4 tests covering login, adding cards, drag-drop, and logout. There is no E2E test that exercises the AI chat sidebar. This is the most complex feature and the only one completely absent from E2E coverage.

#### LOW — Vitest globals used without imports in some lib test files

`api.test.ts` and `auth.test.ts` use `vi`, `describe`, `it`, `expect` without importing them. This works because `vitest.config.ts` sets `globals: true`, but it makes the test files ambiguous (could look like Jest). Prefer explicit imports:

```typescript
import { describe, expect, it, vi } from "vitest";
```

#### LOW — `KanbanBoard.test.tsx` — `renders five columns` generates `act()` warning

The test sets `AUTH_STORAGE_KEY` and renders the board synchronously, but the `useEffect` that loads the board runs after render and triggers a state update outside `act()`. The test passes but emits a React warning on every run. Wrapping the render in `act()` or using `waitFor` would silence it.

---


## Infrastructure

### `Dockerfile`

#### LOW — No `HEALTHCHECK`

Container orchestration systems (Docker Compose `depends_on: condition: service_healthy`, Kubernetes liveness probes) rely on `HEALTHCHECK`. Without it, the container reports healthy the instant it starts even if the app hasn't finished initializing.

**Fix:**

```dockerfile
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s CMD \
  curl -f http://localhost:8000/api/hello || exit 1
```

---

## Issue Summary

| # | Area | File | Severity | Issue |
|---|------|------|----------|-------|
| 1 | Security | `main.py:49–67` | **High** | Path traversal in static file serving |
| 2 | Bug | `KanbanBoard.tsx:344` | **High** | Hardcoded `"user"` passed to AiChat; ignores actual username state |
| 3 | Coverage | `db.py` | **High** | Zero test coverage on all database functions |
| 4 | Coverage | `ai.py` | **High** | Zero test coverage on AI client functions |
| 5 | Reliability | `AiChat.tsx:~64` | **Medium** | No fetch timeout — spinner runs forever on backend hang |
| 6 | Reliability | `KanbanBoard.tsx:74–76` | **Medium** | Silent save failures — user has no feedback on persistence errors |
| 7 | Coverage | `test_main.py` | **Medium** | No negative tests for `PUT /api/board` with invalid payloads |
| 8 | Coverage | `kanban.spec.ts` | **Medium** | No E2E test for AI chat feature |
| 9 | Performance | `db.py` | **Medium** | `init_db()` called on every `get_board()` read |
| 10 | Validation | `models.py` | **Medium** | No field constraints; clients can write empty titles or oversized data |
| 11 | Code quality | `main.py:35` | **Low** | Deprecated `@app.on_event("startup")` — emits warning on every run |
| 12 | Code quality | `main.py:117,147` | **Low** | All non-HTTP exceptions mapped to `400`; timeouts should be `504` |
| 13 | Code quality | `ai.py:11` | **Low** | Model name hardcoded; should be env var |
| 14 | Code quality | `AiChat.tsx:~46,82,100` | **Low** | `Date.now()` for IDs risks React key collisions |
| 15 | Code quality | `kanban.ts` | **Low** | `Math.random()` for card IDs; use `crypto.randomUUID()` |
| 16 | Code quality | `api.ts` | **Low** | No runtime validation of API responses |
| 17 | Code quality | `db.py` | **Low** | Default board duplicated in both Python and TypeScript |
| 18 | Tests | lib test files | **Low** | Vitest globals used without imports |
| 19 | Tests | `KanbanBoard.test.tsx` | **Low** | Spurious `act()` warning in `renders five columns` |
| 20 | Infrastructure | `Dockerfile` | **Low** | No `HEALTHCHECK` instruction |
| 21 | Security | `auth.ts:1–2` | MVP | Hardcoded credentials in source — requires server-side auth for production |
| 22 | Security | `auth.ts:8–9` | MVP | `localStorage` for session — requires `httpOnly` cookies for production |

---

## Recommended Action Order

**Do now (before any further feature work):**
1. Fix path traversal (#1) — add `.resolve().relative_to()` guard in `find_static_file()`
2. Fix hardcoded `"user"` in `KanbanBoard.tsx` (#2) — one-line change, real bug

**Do soon (next development session):**
3. Add tests for `db.py` (#3)
4. Add fetch timeout to `AiChat.tsx` (#5)
5. Fix `init_db()` called on every read (#9)
6. Add Pydantic field constraints to `models.py` (#10)
7. Migrate `@app.on_event` to lifespan (#11)

**Do when extending the project:**
8. Add `HEALTHCHECK` to Dockerfile (#20)
9. Switch card/message IDs to `crypto.randomUUID()` (#14, #15)
10. Add E2E test for AI chat (#8)
11. Add negative API tests (#7)
12. Add coverage for `ai.py` (#4)

**Pre-production only (known MVP trade-offs):**
13. Replace client-side auth with server-side JWT/session (#21, #22)
14. Add proper error feedback for save failures (#6)
