# app/routers/auth.py

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import secrets
import os
import jwt
from jwt import PyJWTError
from pydantic import BaseModel

from ..database import get_db
from ..models import User
from ..schemas import (
    UserRegister,
    UserRead,
    UserActivate,
    UserActivateResponse,
    Token,
)

# ─── Security / JWT setup ─────────────────────────────────

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("JWT_SECRET", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

router = APIRouter(tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/users/token")


def create_access_token(data: dict, expires_delta: timedelta | None = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        email: str | None = payload.get("sub")
        if email is None:
            raise HTTPException(status_code=401, detail="Token payload invalid")
    except PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


# ─── Registration ─────────────────────────────────────────

@router.post("/register", response_model=UserRead, status_code=status.HTTP_201_CREATED)
def register(user: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = pwd_context.hash(user.password)
    token = secrets.token_urlsafe(16)
    db_user = User(
        **user.dict(exclude={"password"}),
        password_hash=hashed,
        token=token,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    # TODO: send_token_email(db_user.email, token)
    return db_user


# ─── OAuth2 Token Endpoint (form‑data) ─────────────────────

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter_by(email=form_data.username).first()
    if not user or not pwd_context.verify(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not user.subscribed or (
        user.date_subscription_expires
        and user.date_subscription_expires < datetime.utcnow()
    ):
        raise HTTPException(status_code=403, detail="Subscription required")
    access = create_access_token({"sub": user.email})
    return {"access_token": access, "token_type": "bearer"}


# ─── JSON Login Model ──────────────────────────────────────

class UserLoginJSON(BaseModel):
    email: str
    password: str


# ─── JSON‑based /login endpoint ───────────────────────────

@router.post("/login", response_model=Token)
def login_json(user: UserLoginJSON, db: Session = Depends(get_db)):
    db_user = db.query(User).filter_by(email=user.email).first()
    if not db_user or not pwd_context.verify(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not db_user.subscribed or (
        db_user.date_subscription_expires
        and db_user.date_subscription_expires < datetime.utcnow()
    ):
        raise HTTPException(status_code=403, detail="Subscription required")
    access_token = create_access_token({"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}


# ─── Activation ────────────────────────────────────────────

@router.post("/activate", response_model=UserActivateResponse)
def activate(payload: UserActivate, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email, token=payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid activation token")
    user.subscribed = True
    user.date_subscribed = datetime.utcnow()
    user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
    db.commit()
    return {"message": "Account activated, subscription is now active."}
