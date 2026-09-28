import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from .. import auth as authlib
from .. import models, schemas
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.LoginOut)
def login(body: schemas.LoginIn, db: Session = Depends(get_db)):
    user = db.query(models.User).filter_by(username=body.username).first()
    if not user or user.status == "pending":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    if user.status == "locked":
        if user.locked_until and user.locked_until > datetime.datetime.utcnow():
            raise HTTPException(
                status.HTTP_423_LOCKED,
                "Account locked due to too many failed attempts. Try again later or ask Admin to unlock.",
            )
        user.status = "active"
        authlib.reset_login_failures(user, db)

    if not authlib.check_password(body.password, user.password_hash):
        authlib.record_login_failure(user, db)
        if user.status == "locked":
            raise HTTPException(
                status.HTTP_423_LOCKED,
                "Account locked due to too many failed attempts. Try again later or ask Admin to unlock.",
            )
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid username or password")

    authlib.reset_login_failures(user, db)
    return {
        "access_token": authlib.make_token(user.id),
        "token_type": "bearer",
        "user": user,
    }


@router.get("/me", response_model=schemas.UserOut)
def me(user: models.User = Depends(authlib.get_current_user)):
    return user
