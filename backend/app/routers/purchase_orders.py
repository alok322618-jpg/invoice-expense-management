import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/purchase-orders", tags=["purchase-orders"])


def _log(po: models.PurchaseOrder, by: str, action: str, remarks: str = ""):
    hist = list(po.history or [])
    hist.append({
        "at": datetime.datetime.utcnow().isoformat(),
        "by": by,
        "action": action,
        "remarks": remarks,
    })
    po.history = hist


@router.get("", response_model=List[schemas.POOut])
def list_pos(
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    return db.query(models.PurchaseOrder).order_by(models.PurchaseOrder.id.desc()).all()


@router.post("", response_model=schemas.POOut)
def create_po(
    body: schemas.POCreateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    if db.query(models.PurchaseOrder).filter_by(po_no=body.po_no).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "PO number already exists")
    po = models.PurchaseOrder(
        po_no=body.po_no, vendor=body.vendor, amount=body.amount,
        status="pending_approval", created_by_id=user.id,
    )
    _log(po, user.username, "created")
    db.add(po)
    db.commit()
    db.refresh(po)
    return po


@router.patch("/{po_id}/review", response_model=schemas.POOut)
def review_po(
    po_id: int,
    body: schemas.POReviewIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    if body.decision not in ("approve", "reject"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "decision must be approve or reject")
    if body.decision == "reject" and not body.remarks.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rejection needs a reason")
    po = db.query(models.PurchaseOrder).filter_by(id=po_id).first()
    if not po:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "PO not found")
    if po.status != "pending_approval":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "PO already reviewed")
    po.status = "approved" if body.decision == "approve" else "rejected"
    po.remarks = body.remarks
    _log(po, user.username, po.status, body.remarks)
    db.commit()
    db.refresh(po)
    return po
