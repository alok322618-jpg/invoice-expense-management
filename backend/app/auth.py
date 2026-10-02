import datetime
import os
import secrets

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from . import models
from .database import get_db

SECRET_KEY = (
    os.environ.get("SECRET_KEY")
    or os.environ.get("SESSION_SECRET")
    or "dev-secret-change-in-production"
)
ALGORITHM = "HS256"
TOKEN_HOURS = 12
MAX_FAILED = 5
LOCK_MINUTES = 15

pwd = CryptContext(schemes=["pbkdf2_sha256"], deprecated="auto")
bearer = HTTPBearer(auto_error=False)


def hash_password(raw: str) -> str:
    return pwd.hash(raw)


def check_password(raw: str, hashed: str) -> bool:
    return pwd.verify(raw, hashed)


def make_token(user_id: int) -> str:
    exp = datetime.datetime.utcnow() + datetime.timedelta(hours=TOKEN_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": exp}, SECRET_KEY, algorithm=ALGORITHM)


def generate_password(length: int = 10) -> str:
    alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"
    return "".join(secrets.choice(alphabet) for _ in range(length))


def make_username(name: str, db: Session) -> str:
    base = "".join(ch for ch in name.lower() if ch.isalnum()) or "user"
    candidate, n = base, 1
    while db.query(models.User).filter_by(username=candidate).first():
        n += 1
        candidate = f"{base}{n}"
    return candidate


def get_current_user(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
    db: Session = Depends(get_db),
) -> models.User:
    if creds is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    try:
        payload = jwt.decode(creds.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid token")
    user = db.query(models.User).filter_by(id=user_id, status="active").first()
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found or inactive")
    return user


def require_roles(*roles: str):
    def guard(user: models.User = Depends(get_current_user)) -> models.User:
        if user.role not in roles:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Not allowed for your role")
        return user

    return guard


def record_login_failure(user: models.User, db: Session) -> None:
    user.failed_attempts = (user.failed_attempts or 0) + 1
    if user.failed_attempts >= MAX_FAILED:
        user.status = "locked"
        user.locked_until = datetime.datetime.utcnow() + datetime.timedelta(minutes=LOCK_MINUTES)
    db.commit()


def reset_login_failures(user: models.User, db: Session) -> None:
    user.failed_attempts = 0
    user.locked_until = None
    db.commit()
