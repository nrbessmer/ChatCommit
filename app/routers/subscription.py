import os
import logging
from datetime import datetime

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session
from passlib.context import CryptContext

from ..database import get_db
from ..models import User
from app.routers.auth import create_access_token

# logging setup
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# load & validate env vars
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")

if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
    raise RuntimeError("Missing Stripe configuration in environment")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(tags=["subscription"])

class SubscriptionRequest(BaseModel):
    email: EmailStr
    password: str
    paymentMethodId: str
    planId: str

class SubscriptionResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    subscribed: bool
    date_subscribed: datetime
    date_subscription_expires: datetime

@router.post(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK,
)
def subscribe_and_activate(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db),
):
    logger.info(f"Subscription request for {payload.email}")

    # 1) authenticate existing user
    user = db.query(User).filter(User.email == payload.email).first()
    pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")
    if not user or not pwd_ctx.verify(payload.password, user.password_hash):
        logger.warning("Invalid credentials for subscription")
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    # 2) ensure Stripe customer
    if not user.stripe_customer_id:
        logger.info("Creating new Stripe customer")
        customer = stripe.Customer.create(
            email=user.email, name=user.full_name
        )
        user.stripe_customer_id = customer.id
        db.commit()
    else:
        customer = stripe.Customer.retrieve(user.stripe_customer_id)

    # 3) attach payment method and set default
    stripe.PaymentMethod.attach(
        payload.paymentMethodId,
        customer=customer.id,
    )
    stripe.Customer.modify(
        customer.id,
        invoice_settings={"default_payment_method": payload.paymentMethodId},
    )

    # 4) create subscription
    subscription = stripe.Subscription.create(
        customer=customer.id,
        items=[{"price": payload.planId}],
        expand=["latest_invoice.payment_intent"],
    )
    now = datetime.utcfromtimestamp(subscription.created)
    expires = datetime.utcfromtimestamp(subscription.current_period_end)

    # 5) update local DB and clear activation token
    user.subscribed = True
    user.date_subscribed = now
    user.date_subscription_expires = expires
    user.token = ""
    db.commit()

    # 6) issue fresh JWT
    token = create_access_token({"sub": str(user.id)})
    logger.info(f"User {user.email} subscribed & activated")

    return SubscriptionResponse(
        access_token=token,
        subscribed=True,
        date_subscribed=now,
        date_subscription_expires=expires,
    )
