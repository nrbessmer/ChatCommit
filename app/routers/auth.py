from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
import secrets
import os
import jwt
from jwt import PyJWTError
from pydantic import BaseModel, EmailStr

# Absolute imports
from app.database import get_db
from app.models import User
from app.schemas import (
    UserRegister,
    UserActivate,
    UserActivateResponse,
    Token,
)

# ─── Security / JWT setup ─────────────────────────────────
SECRET_KEY = os.getenv("JWT_SECRET", secrets.token_hex(32))
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# Mount under /users
router = APIRouter(prefix="/users", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/users/token")

# Use CryptContext instead of bcrypt directly
pwd_context = CryptContext(schemes=["sha256_crypt"], deprecated="auto")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

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
    except PyJWTError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
    
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ─── Models ───────────────────────────────────────────────

class RegisterResponse(BaseModel):
    id: int
    full_name: str
    email: str
    company: str
    address: str
    subscribed: bool
    access_token: str
    token_type: str = "bearer"

class UserLoginJSON(BaseModel):
    email: EmailStr
    password: str

# ─── Registration ─────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(user: UserRegister, db: Session = Depends(get_db)):
    if db.query(User).filter_by(email=user.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed = get_password_hash(user.password)
    token = secrets.token_urlsafe(16)
    
    db_user = User(
        **user.dict(exclude={"password"}),
        password_hash=hashed,
        token=token,
        subscribed=False
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    # Generate access token for immediate use
    access_token = create_access_token({"sub": db_user.email})

    return {
        "id": db_user.id,
        "full_name": db_user.full_name,
        "email": db_user.email,
        "company": db_user.company,
        "address": db_user.address,
        "subscribed": db_user.subscribed,
        "access_token": access_token,
        "token_type": "bearer"
    }

# ─── OAuth2 Token Endpoint (form‑data) ─────────────────────

@router.post("/token", response_model=Token)
def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter_by(email=form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    access_token = create_access_token({"sub": user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# ─── JSON‑based /login endpoint ───────────────────────────

@router.post("/login", response_model=Token)
def login_json(user: UserLoginJSON, db: Session = Depends(get_db)):
    db_user = db.query(User).filter_by(email=user.email).first()
    if not db_user or not verify_password(user.password, db_user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    access_token = create_access_token({"sub": db_user.email})
    return {"access_token": access_token, "token_type": "bearer"}

# ─── Activation ────────────────────────────────────────────

@router.post("/activate", response_model=UserActivateResponse)
def activate(payload: UserActivate, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(email=payload.email, token=payload.token).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid activation token")
    
    access_token = create_access_token({"sub": user.email})
    return {
        "message": "Account activated.",
        "access_token": access_token,
        "token_type": "bearer"
    }
