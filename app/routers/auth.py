# app/routers/auth.py

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..schemas import UserRegister, UserRead, Token
import secrets
import os
import jwt
from jwt import PyJWTError

# ─── Security & JWT setup ─────────────────────────────────
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET", secrets.token_hex(32))
ALGORITHM = "HS256"

# This router has no global prefix; you mount it in main.py as `auth`.
router = APIRouter(tags=["auth"])

# OAuth2 scheme pointing at the /token endpoint
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token payload invalid")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.email == email).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ─── Registration Endpoint ─────────────────────────────────
@router.post("/register", response_model=UserRead)
def register(user: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = pwd_context.hash(user.password)
    token = secrets.token_urlsafe(16)
    db_user = User(
        **user.dict(exclude={"password"}),
        password_hash=hashed,
        token=token
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    # TODO: send_token_email(db_user.email, token)
    return db_user


# ─── OAuth2 Token Endpoint ────────────────────────────────
@router.post("/token", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter_by(email=form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access = create_access_token({"sub": user.email})
    return {
        "access_token": access,
        "token_type": "bearer"
    }


# ─── Shim for your extension: POST /users/login ────────────
@router.post("/users/login", response_model=Token)
def login_via_users(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    # Simply delegate to the same logic as /token
    return login(form_data, db)


def create_access_token(
    data: dict,
    expires_delta: timedelta = timedelta(hours=24)
):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
