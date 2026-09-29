import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/payments", tags=["payments"])


def _out(p: models.Payment) -> dict:
    return {
        "id": p.id,
        "invoice_id": p.invoice_id,
        "invoice_no": p.invoice.invoice_no if p.invoice else "",
        "vendor": p.invoice.vendor if p.invoice else "",
        "amount": p.amount,
        "payment_date": p.payment_date,
        "method": p.method or "",
        "reference_no": p.reference_no or "",
        "status": p.status,
        "remarks": p.remarks or "",
        "created_at": p.created_at,
    }


def _allocated(invoice_id: int, db: Session, exclude_id: Optional[int] = None) -> float:
    q = db.query(func.coalesce(func.sum(models.Payment.amount), 0)).filter(
        models.Payment.invoice_id == invoice_id,
        models.Payment.status.in_(["scheduled", "paid"]),
    )
    if exclude_id:
        q = q.filter(models.Payment.id != exclude_id)
    return float(q.scalar() or 0.0)


@router.get("", response_model=List[schemas.PaymentOut])
def list_payments(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    q = db.query(models.Payment)
    if status:
        q = q.filter_by(status=status)
    return [_out(p) for p in q.order_by(models.Payment.id.desc()).all()]


@router.get("/payable", response_model=List[schemas.PayableInvoiceOut])
def payable_invoices(
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager", "finance")),
):
    result = []
    invoices = db.query(models.Invoice).filter_by(status="approved").order_by(models.Invoice.id.desc()).all()
    for inv in invoices:
        remaining = round(inv.amount - _allocated(inv.id, db), 2)
        if remaining > 0:
            result.append({
                "id": inv.id,
                "invoice_no": inv.invoice_no,
                "vendor": inv.vendor,
                "amount": inv.amount,
                "remaining": remaining,
            })
    return result


@router.post("", response_model=schemas.PaymentOut)
def create_payment(
    body: schemas.PaymentCreateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager", "finance")),
):
    inv = db.query(models.Invoice).filter_by(id=body.invoice_id).first()
    if not inv:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Invoice not found")
    if inv.status != "approved":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Payment can only be recorded for approved invoices")
    remaining = round(inv.amount - _allocated(inv.id, db), 2)
    if body.amount > remaining:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Amount exceeds unpaid balance of {remaining}",
        )
    pay = models.Payment(
        invoice_id=inv.id,
        amount=body.amount,
        payment_date=body.payment_date,
        method=body.method,
        reference_no=body.reference_no,
        remarks=body.remarks,
        status="scheduled",
        created_by_id=user.id,
    )
    db.add(pay)
    db.commit()
    db.refresh(pay)
    return _out(pay)


@router.patch("/{payment_id}/mark-paid", response_model=schemas.PaymentOut)
def mark_paid(
    payment_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    pay = db.query(models.Payment).filter_by(id=payment_id, status="scheduled").first()
    if not pay:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scheduled payment not found")
    pay.status = "paid"
    db.commit()
    db.refresh(pay)
    return _out(pay)


@router.patch("/{payment_id}/cancel", response_model=schemas.PaymentOut)
def cancel_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    pay = db.query(models.Payment).filter_by(id=payment_id, status="scheduled").first()
    if not pay:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Scheduled payment not found")
    pay.status = "cancelled"
    db.commit()
    db.refresh(pay)
    return _out(pay)
