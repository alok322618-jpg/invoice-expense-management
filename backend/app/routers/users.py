from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/users", tags=["users"])

CREATABLE_BY_ADMIN = {"admin", "manager", "finance", "viewer", "employee"}
CREATABLE_BY_MANAGER = {"manager", "finance", "viewer", "employee"}


def _visible(users: List[models.User], viewer: models.User) -> List[models.User]:
    if viewer.role == "admin":
        return users
    return [u for u in users if u.role != "admin"]


@router.get("", response_model=List[schemas.UserOut])
def list_users(
    role: Optional[str] = None,
    db: Session = Depends(get_db),
    viewer: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    q = db.query(models.User)
    if role:
        q = q.filter_by(role=role)
    return _visible(q.order_by(models.User.id).all(), viewer)


@router.post("", response_model=schemas.UserCreateOut)
def create_user(
    body: schemas.UserCreateIn,
    db: Session = Depends(get_db),
    creator: models.User = Depends(authlib.require_roles("admin", "manager")),
):
    if creator.role == "admin":
        allowed = CREATABLE_BY_ADMIN
    else:
        allowed = CREATABLE_BY_MANAGER
    if body.role not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot create this role")

    username = authlib.make_username(body.name, db)
    user = models.User(
        username=username,
        password_hash="",
        name=body.name,
        role=body.role,
        location=body.location,
        created_by=creator.username,
    )
    if creator.role == "admin":
        password = authlib.generate_password()
        user.password_hash = authlib.hash_password(password)
        user.status = "active"
        message = "User created and activated."
    else:
        password = None
        user.password_hash = ""
        user.status = "pending"
        message = "Request sent to Admin for approval."
    db.add(user)
    db.commit()
    db.refresh(user)
    return {"user": user, "username": username, "password": password, "message": message}


@router.patch("/{user_id}/approve", response_model=schemas.UserCreateOut)
def approve_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(authlib.require_roles("admin")),
):
    user = db.query(models.User).filter_by(id=user_id, status="pending").first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pending user not found")
    password = authlib.generate_password()
    user.password_hash = authlib.hash_password(password)
    user.status = "active"
    db.commit()
    db.refresh(user)
    return {"user": user, "username": user.username, "password": password,
            "message": "User approved and activated."}


@router.patch("/{user_id}/unlock", response_model=schemas.UserOut)
def unlock_user(
    user_id: int,
    db: Session = Depends(get_db),
    admin: models.User = Depends(authlib.require_roles("admin")),
):
    user = db.query(models.User).filter_by(id=user_id, status="locked").first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Locked user not found")
    user.status = "active"
    authlib.reset_login_failures(user, db)
    db.refresh(user)
    return user
