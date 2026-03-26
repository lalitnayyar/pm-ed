# Backend

## Local Run

```bash
uv run uvicorn app.main:app --app-dir backend --host 0.0.0.0 --port 8000
```

## Tests

```bash
uv run --directory backend pytest
```
