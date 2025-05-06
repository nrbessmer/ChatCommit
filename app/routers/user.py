# app/routers/user.py

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from passlib.context import CryptContext
import secrets, os

from ..database import get_db
from ..models import User
from ..schemas import (
    UserRegister, UserRegisterResponse,
    UserActivate,  UserActivateResponse
)

# for sending email
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig

router = APIRouter(prefix="/users", tags=["users"])

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

# configure FastMail via ENV vars
conf = ConnectionConfig(
    MAIL_USERNAME = os.getenv("MAIL_USERNAME"),
    MAIL_PASSWORD = os.getenv("MAIL_PASSWORD"),
    MAIL_FROM     = os.getenv("MAIL_FROM"),
    MAIL_PORT     = int(os.getenv("MAIL_PORT", 587)),
    MAIL_SERVER   = os.getenv("MAIL_SERVER"),
    MAIL_TLS      = True,
    MAIL_SSL      = False,
    USE_CREDENTIALS = True,
)

def send_activation_email(to_email: str, token: str):
    link = f"{os.getenv('FRONTEND_URL')}/activate?email={to_email}&token={token}"
    message = MessageSchema(
        subject="Activate your ChatCommit account",
        recipients=[to_email],
        body=f"Welcome! Click to activate:\n\n{link}",
        subtype="plain"
    )
    fm = FastMail(conf)
    fm.send_message(message)


@router.post(
    "/register",
    response_model=UserRegisterResponse,
    status_code=status.HTTP_201_CREATED
)
async def register_user(
    payload: UserRegister,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    # 1) ensure unique
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # 2) hash + token
    pw_hash = pwd_ctx.hash(payload.password)
    token   = secrets.token_urlsafe(32)
    user = User(
        full_name     = payload.full_name,
        address       = payload.address,
        email         = payload.email,
        company       = payload.company,
        password_hash = pw_hash,
        token         = token
    )
    db.add(user)
    db.commit()

    # 3) send activation link in background
    background_tasks.add_task(send_activation_email, payload.email, token)

    return {"message": "Registration successful. Check your email to activate."}


@router.post(
    "/activate",
    response_model=UserActivateResponse
)
def activate_user(
    payload: UserActivate,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter_by(
        email=payload.email,
        token=payload.token
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid token or email")

    # mark active by clearing token (or use a flag)
    user.token = ""
    db.commit()
    return {"message": "Account activated! You may now log in."}

