import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

events_router = APIRouter(prefix="/events", tags=["events"])
dash_router = APIRouter(prefix="/dashboard", tags=["dashboard"])


def _event_out(ev: models.Event, invoice_count: int = 0) -> dict:
    return {
        "id": ev.id,
        "name": ev.name,
        "date": ev.date,
        "location": ev.location or "",
        "budget": ev.budget,
        "status": ev.status,
        "vendor_id": ev.vendor_id,
        "vendor_name": ev.vendor_rec.name if ev.vendor_rec else None,
        "invoice_count": invoice_count,
        "created_at": ev.created_at,
    }


@events_router.get("", response_model=List[schemas.EventOut])
def list_events(
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    counts = dict(
        db.query(models.Invoice.event_id, func.count(models.Invoice.id))
        .filter(models.Invoice.event_id.isnot(None))
        .group_by(models.Invoice.event_id)
        .all()
    )
    return [_event_out(ev, counts.get(ev.id, 0)) for ev in db.query(models.Event).order_by(models.Event.date).all()]


@events_router.post("", response_model=schemas.EventOut)
def create_event(
    body: schemas.EventCreateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    vendor = None
    if body.vendor_id:
        vendor = db.query(models.Vendor).filter_by(id=body.vendor_id, status="active").first()
        if not vendor:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vendor not found or inactive")
    ev = models.Event(
        name=body.name,
        date=body.date,
        location=body.location,
        budget=body.budget,
        vendor_id=vendor.id if vendor else None,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return _event_out(ev)


@events_router.patch("/{event_id}", response_model=schemas.EventOut)
def update_event(
    event_id: int,
    body: schemas.EventUpdateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    ev = db.query(models.Event).filter_by(id=event_id).first()
    if not ev:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Event not found")
    data = body.model_dump(exclude_unset=True)
    if "vendor_id" in data:
        if data["vendor_id"] is None:
            ev.vendor_id = None
        else:
            vendor = db.query(models.Vendor).filter_by(id=data["vendor_id"], status="active").first()
            if not vendor:
                raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vendor not found or inactive")
            ev.vendor_id = vendor.id
        del data["vendor_id"]
    for key, value in data.items():
        setattr(ev, key, value)
    db.commit()
    db.refresh(ev)
    count = db.query(func.count(models.Invoice.id)).filter_by(event_id=ev.id).scalar() or 0
    return _event_out(ev, count)


@dash_router.get("", response_model=schemas.DashboardOut)
def dashboard(
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    pending = db.query(models.Invoice).filter(
        models.Invoice.status.in_(["captured", "assigned", "in_verification"])).count()
    delayed = db.query(models.Invoice).filter(
        models.Invoice.status.in_(["captured", "assigned", "in_verification"]),
        models.Invoice.due_date < datetime.date.today()).count()
    month_start = datetime.date.today().replace(day=1)
    approved_month = db.query(models.Invoice).filter(
        models.Invoice.status == "approved",
        models.Invoice.created_at >= datetime.datetime.combine(month_start, datetime.time.min)).count()
    total_spend = db.query(func.coalesce(func.sum(models.Invoice.amount), 0)).filter(
        models.Invoice.status == "approved").scalar() or 0.0
    pending_users = db.query(models.User).filter_by(status="pending").count()
    open_pos = db.query(models.PurchaseOrder).filter_by(status="pending_approval").count()
    pending_amount = db.query(func.coalesce(func.sum(models.Invoice.amount), 0)).filter(
        models.Invoice.status.in_(["captured", "assigned", "in_verification"])).scalar() or 0.0
    paid_amount = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(
        models.Payment.status == "paid").scalar() or 0.0
    scheduled = db.query(models.Payment).filter_by(status="scheduled").count()
    vendors = db.query(models.Vendor).filter_by(status="active").count()
    return {
        "pending_invoices": pending,
        "delayed_invoices": delayed,
        "approved_this_month": approved_month,
        "total_spend": round(float(total_spend), 2),
        "pending_users": pending_users,
        "open_pos": open_pos,
        "total_pending_amount": round(float(pending_amount), 2),
        "total_paid_amount": round(float(paid_amount), 2),
        "scheduled_payments": scheduled,
        "vendors": vendors,
    }


@dash_router.get("/employees", response_model=List[schemas.EmployeeStatOut])
def employee_stats(
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager", "finance")),
):
    rows = []
    for u in db.query(models.User).filter(models.User.status == "active").order_by(models.User.name).all():
        invs = db.query(models.Invoice).filter_by(created_by_id=u.id).all()
        total = len(invs)
        pending = sum(1 for i in invs if i.status in ("captured", "assigned", "in_verification"))
        approved = sum(1 for i in invs if i.status == "approved")
        rejected = sum(1 for i in invs if i.status == "rejected")
        rows.append({
            "user_id": u.id,
            "name": u.name,
            "role": u.role,
            "total": total,
            "pending": pending,
            "approved": approved,
            "rejected": rejected,
            "total_amount": round(sum(i.amount or 0 for i in invs), 2),
        })
    return rows


VENDOR_SORT_FIELDS = {
    "name": None,
    "invoice_count": None,
    "approved_count": None,
    "rejected_count": None,
    "approved_amount": None,
    "paid_amount": None,
}


@dash_router.get("/vendors", response_model=List[schemas.VendorStatOut])
def vendor_stats(
    sort_by: Optional[str] = "paid_amount",
    order: Optional[str] = "desc",
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager", "finance")),
):
    if sort_by not in VENDOR_SORT_FIELDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Invalid sort field")
    reverse = (order or "desc").lower() != "asc"
    rows = []
    for v in db.query(models.Vendor).order_by(models.Vendor.name).all():
        invs = db.query(models.Invoice).filter_by(vendor_id=v.id).all()
        approved_ids = [i.id for i in invs if i.status == "approved"]
        paid = 0.0
        if approved_ids:
            paid = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(
                models.Payment.invoice_id.in_(approved_ids),
                models.Payment.status == "paid",
            ).scalar() or 0.0
        rows.append({
            "vendor_id": v.id,
            "name": v.name,
            "invoice_count": len(invs),
            "approved_count": sum(1 for i in invs if i.status == "approved"),
            "rejected_count": sum(1 for i in invs if i.status == "rejected"),
            "approved_amount": round(sum(i.amount or 0 for i in invs if i.status == "approved"), 2),
            "paid_amount": round(float(paid), 2),
        })
    rows.sort(key=lambda r: (r[sort_by] is None, r[sort_by]), reverse=reverse)
    return rows
