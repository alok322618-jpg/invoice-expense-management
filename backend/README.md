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

## Bulk invoice upload

`POST /api/invoices/bulk-upload` (admin/manager/finance) accepts a `.csv` or `.xlsx` file with
columns `invoice_no, vendor, amount, invoice_date` (YYYY-MM-DD or DD-MM-YYYY), optional `due_date`.
Rows are validated, duplicates skipped, and valid rows are created with status `captured` so they
flow through the normal assign/verify lifecycle. Response: `{added, skipped: [{row, invoice_no, reason}], total}`.

## Payments

Approved invoices can be paid through the payment chain:

- `GET /api/payments/payable` — approved invoices with remaining unpaid balance
- `POST /api/payments` (admin/manager/finance) — record a payment against an approved invoice; amount cannot exceed the unpaid balance; payment starts as `scheduled`
- `PATCH /api/payments/{id}/mark-paid` (admin/manager) — mark a scheduled payment `paid`
- `PATCH /api/payments/{id}/cancel` (admin/manager) — cancel a scheduled payment
- Dashboard also reports `total_pending_amount`, `total_paid_amount` and `scheduled_payments`.
