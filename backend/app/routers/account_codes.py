from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/account-codes", tags=["account-codes"])


@router.get("", response_model=List[schemas.AccountCodeOut])
def list_codes(
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.get_current_user),
):
    q = db.query(models.AccountCode)
    if status:
        q = q.filter_by(status=status)
    return q.order_by(models.AccountCode.code).all()


@router.post("", response_model=schemas.AccountCodeOut)
def create_code(
    body: schemas.AccountCodeCreateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    code = body.code.strip()
    if db.query(models.AccountCode).filter(models.AccountCode.code.ilike(code)).first():
        raise HTTPException(status.HTTP_409_CONFLICT, "Account code already exists")
    ac = models.AccountCode(code=code, name=body.name.strip())
    db.add(ac)
    db.commit()
    db.refresh(ac)
    return ac


@router.patch("/{code_id}", response_model=schemas.AccountCodeOut)
def update_code(
    code_id: int,
    body: schemas.AccountCodeUpdateIn,
    db: Session = Depends(get_db),
    user: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    ac = db.query(models.AccountCode).filter_by(id=code_id).first()
    if not ac:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Account code not found")
    data = body.model_dump(exclude_unset=True)
    if "status" in data and data["status"] not in ("active", "inactive"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "status must be active or inactive")
    for key, value in data.items():
        setattr(ac, key, value.strip() if isinstance(value, str) else value)
    db.commit()
    db.refresh(ac)
    return ac
