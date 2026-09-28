import datetime

from . import auth as authlib
from . import models
from .database import SessionLocal


def seed():
    db = SessionLocal()
    try:
        if db.query(models.User).first():
            return
        admin = models.User(
            username="admin",
            password_hash=authlib.hash_password("admin123"),
            name="System Administrator",
            role="admin",
            location="Mumbai",
            status="active",
            created_by="seed",
        )
        manager = models.User(
            username="priya",
            password_hash=authlib.hash_password("manager123"),
            name="Priya Nair",
            role="manager",
            location="Mumbai",
            status="active",
            created_by="seed",
        )
        finance = models.User(
            username="arjun",
            password_hash=authlib.hash_password("finance123"),
            name="Arjun Mehta",
            role="finance",
            location="Bengaluru",
            status="active",
            created_by="seed",
        )
        db.add_all([admin, manager, finance])
        db.flush()

        today = datetime.date.today()
        invoices = [
            models.Invoice(invoice_no="INV-2026-101", vendor="Sharma Caterers", amount=45000,
                           invoice_date=today - datetime.timedelta(days=6),
                           due_date=today + datetime.timedelta(days=4),
                           status="assigned", assignee_id=finance.id,
                           history=[{"at": datetime.datetime.utcnow().isoformat(),
                                     "by": "seed", "action": "captured", "remarks": ""}]),
            models.Invoice(invoice_no="INV-2026-102", vendor="City Travels", amount=28500,
                           invoice_date=today - datetime.timedelta(days=12),
                           due_date=today - datetime.timedelta(days=2),
                           status="in_verification", assignee_id=finance.id,
                           history=[{"at": datetime.datetime.utcnow().isoformat(),
                                     "by": "seed", "action": "captured", "remarks": ""}]),
            models.Invoice(invoice_no="INV-2026-103", vendor="Grand Hotel", amount=120000,
                           invoice_date=today - datetime.timedelta(days=3),
                           due_date=today + datetime.timedelta(days=10),
                           status="captured",
                           history=[{"at": datetime.datetime.utcnow().isoformat(),
                                     "by": "seed", "action": "captured", "remarks": ""}]),
        ]
        pos = [
            models.PurchaseOrder(po_no="PO-2026-011", vendor="Office Supplies Co", amount=15000,
                                 status="pending_approval", created_by_id=manager.id,
                                 history=[{"at": datetime.datetime.utcnow().isoformat(),
                                           "by": "seed", "action": "created", "remarks": ""}]),
        ]
        events = [
            models.Event(name="Annual Dealer Meet", date=today + datetime.timedelta(days=20),
                         location="Mumbai", budget=500000, status="planned"),
        ]
        db.add_all(invoices + pos + events)
        db.commit()
        print("Seeded demo data: admin/admin123, priya/manager123, arjun/finance123")
    finally:
        db.close()
