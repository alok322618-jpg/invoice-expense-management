import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./invoice_expense.db")

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def migrate():
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    stmts = []
    if "invoices" in tables:
        cols = {c["name"] for c in insp.get_columns("invoices")}
        if "created_by_id" not in cols:
            stmts.append("ALTER TABLE invoices ADD COLUMN created_by_id INTEGER")
        if "attachment" not in cols:
            stmts.append("ALTER TABLE invoices ADD COLUMN attachment VARCHAR(256) DEFAULT ''")
        if "event_id" not in cols:
            stmts.append("ALTER TABLE invoices ADD COLUMN event_id INTEGER")
    if "events" in tables:
        cols = {c["name"] for c in insp.get_columns("events")}
        if "vendor_id" not in cols:
            stmts.append("ALTER TABLE events ADD COLUMN vendor_id INTEGER")
    if stmts:
        with engine.begin() as conn:
            for s in stmts:
                conn.execute(text(s))
