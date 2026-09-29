from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/vendors", tags=["vendors"])


def _out(v: models.Vendor, db: Session) -> dict:
    count = db.query(models.Invoice).filter_by(vendor_id=v.id).count()
    return {
        "id": v.id,
        "name": v.name,
        "contact_name": v.contact_name or "",
        "contact_email": v.contact_email or "",
        "contact_phone": v.contact_phone or "",
        "bank_name": v.bank_name or "",
        "account_no": v.account_no or "",
        "ifsc": v.ifsc or "",
        "address": v.address or "",
        "status": v.status,
        "invoice_count": count,
        "created_at": v.created_at,
    }


def resolve_vendor(db: Session, vendor_id: Optional[int], name: str) -> models.Vendor:
    if vendor_id:
        v = db.query(models.Vendor).filter_by(id=vendor_id, status="active").first()
        if not v:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vendor not found or inactive")
        return v
    clean = (name or "").strip()
    if not clean:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vendor name is required")
    v = db.query(models.Vendor).filter(models.Vendor.name.ilike(clean)).first()
    if v:
        if v.status != "active":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Vendor is inactive")
        return v
    v = models.Vendor(name=clean)
    db.add(v)
    db.flush()
    return v


@router.get("", response_model=List[schemas.VendorOut])
def list_vendors(
    search: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    q = db.query(models.Vendor)
    if status:
        q = q.filter_by(status=status)
    if search:
        q = q.filter(models.Vendor.name.ilike(f"%{search}%"))
    return [_out(v, db) for v in q.order_by(models.Vendor.name).all()]


@router.post("", response_model=schemas.VendorOut)
def create_vendor(
    body: schemas.VendorCreateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager", "finance")),
):
    clean = body.name.strip()
    if db.query(models.Vendor).filter(models.Vendor.name.ilike(clean)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Vendor already exists")
    v = models.Vendor(
        name=clean,
        contact_name=body.contact_name,
        contact_email=body.contact_email,
        contact_phone=body.contact_phone,
        bank_name=body.bank_name,
        account_no=body.account_no,
        ifsc=body.ifsc,
        address=body.address,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _out(v, db)


@router.get("/{vendor_id}", response_model=schemas.VendorOut)
def get_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    v = db.query(models.Vendor).filter_by(id=vendor_id).first()
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor not found")
    return _out(v, db)


@router.patch("/{vendor_id}", response_model=schemas.VendorOut)
def update_vendor(
    vendor_id: int,
    body: schemas.VendorUpdateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager", "finance")),
):
    v = db.query(models.Vendor).filter_by(id=vendor_id).first()
    if not v:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Vendor not found")
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in ("active", "inactive"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "status must be active or inactive")
    for key, value in data.items():
        setattr(v, key, value)
    db.commit()
    db.refresh(v)
    return _out(v, db)
