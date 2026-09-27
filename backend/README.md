# Backend — Invoice & Expense Management API

FastAPI + SQLAlchemy. SQLite by default (zero setup); PostgreSQL via `DATABASE_URL`.

## Run

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Demo logins (seeded on first run)

| Username | Password   | Role    |
|----------|------------|---------|
| admin    | admin123   | Admin   |
| priya    | manager123 | Manager |
| arjun    | finance123 | Finance |

Change these before any real use. Set `SECRET_KEY` env var in production.

## Notes

- Login is the first page of the system (FR-11). No self-registration.
- 5 wrong passwords → account locked for 15 minutes; Admin can unlock.
- Manager-created users go to Admin for approval; Admin-created users are active immediately with generated credentials.
