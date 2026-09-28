import datetime
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

events_router = APIRouter(prefix="/events", tags=["events"])
dash_router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@events_router.get("", response_model=List[schemas.EventOut])
def list_events(
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    return db.query(models.Event).order_by(models.Event.date).all()


@events_router.post("", response_model=schemas.EventOut)
def create_event(
    body: schemas.EventCreateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    ev = models.Event(name=body.name, date=body.date, location=body.location, budget=body.budget)
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


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
    return {
        "pending_invoices": pending,
        "delayed_invoices": delayed,
        "approved_this_month": approved_month,
        "total_spend": round(float(total_spend), 2),
        "pending_users": pending_users,
        "open_pos": open_pos,
    }
