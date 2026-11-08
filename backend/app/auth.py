from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .config import settings
from .database import get_db
from .models import Admin

ALGO = "HS256"
bearer = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    # Les hash PHP (password_hash) commencent par $2y$ : compatibles bcrypt une fois renommés en $2b$.
    if hashed.startswith("$2y$"):
        hashed = "$2b$" + hashed[4:]
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def create_token(admin: Admin) -> str:
    exp = datetime.now(timezone.utc) + timedelta(minutes=settings.token_expire_minutes)
    return jwt.encode({"sub": str(admin.id), "exp": exp}, settings.secret_key, algorithm=ALGO)


def current_admin(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> Admin:
    unauthorized = HTTPException(status.HTTP_401_UNAUTHORIZED, "Session expirée, reconnectez-vous.")
    if not creds:
        raise unauthorized
    try:
        payload = jwt.decode(creds.credentials, settings.secret_key, algorithms=[ALGO])
    except jwt.PyJWTError:
        raise unauthorized
    admin = db.get(Admin, int(payload.get("sub", 0)))
    if not admin:
        raise unauthorized
    return admin
