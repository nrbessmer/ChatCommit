# app/routers/user.py

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.orm import Session
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig
import os

from ..database import get_db
from ..models import User
from ..schemas import (
    UserRegister, UserRegisterResponse,
    UserActivate, UserActivateResponse,
)
from .auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])

pwd_ctx = None  # assume password hashing is handled elsewhere

# configure FastMail via ENV vars
def _get_mail_config():
    return ConnectionConfig(
        MAIL_USERNAME=os.getenv("MAIL_USERNAME"),
        MAIL_PASSWORD=os.getenv("MAIL_PASSWORD"),
        MAIL_FROM=os.getenv("MAIL_FROM"),
        MAIL_PORT=int(os.getenv("MAIL_PORT", 587)),
        MAIL_SERVER=os.getenv("MAIL_SERVER"),
        MAIL_STARTTLS=True,
        MAIL_SSL_TLS=False,
        USE_CREDENTIALS=True,
    )

async def send_activation_email(to_email: str, token: str):
    link = f"{os.getenv('FRONTEND_URL')}/activate?email={to_email}&token={token}"
    message = MessageSchema(
        subject="Activate your ChatCommit account",
        recipients=[to_email],
        body=f"Welcome! Click to activate your account:\n\n{link}",
        subtype="plain",
    )
    fm = FastMail(_get_mail_config())
    await fm.send_message(message)

async def send_extension_email(to_email: str, extension_url: str):
    message = MessageSchema(
        subject="Your ChatCommit Extension Download",
        recipients=[to_email],
        body=f"Thank you for subscribing! Download the browser extension here:\n\n{extension_url}",
        subtype="plain",
    )
    fm = FastMail(_get_mail_config())
    await fm.send_message(message)

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
    # validate uniqueness
    if db.query(User).filter_by(email=payload.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    # hash & token
    hashed = pwd_ctx.hash(payload.password) if pwd_ctx else payload.password
    token = secrets.token_urlsafe(32)
    user = User(
        full_name=payload.full_name,
        address=payload.address,
        email=payload.email,
        company=payload.company,
        password_hash=hashed,
        token=token,
    )
    db.add(user)
    db.commit()
    # send activation email
    background_tasks.add_task(send_activation_email, payload.email, token)
    # after register, front-end should redirect user to subscription form
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
    user.token = ""
    user.subscribed = False
    db.commit()
    return {"message": "Account activated! You may now subscribe."}

@router.post(
    "/extension-instructions",
    status_code=status.HTTP_202_ACCEPTED
)
async def extension_instructions(
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user)
):
    # sends extension download link to subscriber
    extension_url = os.getenv("EXTENSION_URL", "https://yourdomain.com/extension.zip")
    background_tasks.add_task(send_extension_email, current_user.email, extension_url)
    return {"message": "Extension download link sent to your email."}


# app/routers/stripe.py

import os
import stripe
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, status, BackgroundTasks
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from .auth import get_current_user

router = APIRouter(prefix="/stripe", tags=["stripe"])

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")
ENDPOINT_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

@router.post("/create-checkout-session")
def create_checkout_session(
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = request.json()
    price_id = data.get("planId")
    if not price_id:
        raise HTTPException(status_code=400, detail="Missing planId")

    # ensure Stripe customer
    if not current_user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=current_user.email,
            metadata={"user_id": current_user.id}
        )
        current_user.stripe_customer_id = customer.id
        db.commit()
    else:
        customer = stripe.Customer.retrieve(current_user.stripe_customer_id)

    session = stripe.checkout.Session.create(
        customer=customer.id,
        payment_method_types=["card"],
        line_items=[{"price": price_id, "quantity": 1}],
        mode="subscription",
        success_url=os.getenv("FRONTEND_URL") + "/subscription-success",
        cancel_url=os.getenv("FRONTEND_URL") + "/subscription-cancel",
        metadata={"user_id": current_user.id},
    )
    return {"url": session.url, "message": "Use test card 4242 4242 4242 4242"}

@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, ENDPOINT_SECRET
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        sess = event["data"]["object"]
        user_id = int(sess["metadata"]["user_id"])
        user = db.query(User).get(user_id)
        if user:
            user.subscribed = True
            user.date_subscribed = datetime.utcnow()
            user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
            db.commit()
            # send extension link
            extension_url = os.getenv("EXTENSION_URL", "https://yourdomain.com/extension.zip")
            background_tasks.add_task(send_extension_email, user.email, extension_url)

    return {"status": "success"}
