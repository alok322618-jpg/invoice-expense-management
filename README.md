# Invoice & Expense Management System

Client project — real backend + frontend (prototype retired).

## Structure

- `backend/` — FastAPI API (auth with lockout, users, invoices, purchase orders, events, dashboard). SQLite by default, PostgreSQL via `DATABASE_URL`. See `backend/README.md`.
- `frontend/` — plain HTML/CSS/JS app (no build step). Login-first, role-based, talks to the backend API. Open `frontend/index.html` or serve statically.
- `build_srs.py` — SRS PDF build script (generates the client-facing SRS document).

## Quick start

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Then open `frontend/index.html` (set `API_BASE` in `frontend/app.js` if the backend isn't on `http://localhost:8000`).

Demo logins: `admin/admin123`, `priya/manager123`, `arjun/finance123`.
