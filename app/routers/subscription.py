# app/routers/subscription.py

import os
import logging
from datetime import datetime

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from app.routers.auth import get_current_user

# ─── Logging ─────────────────────────────────────────────────
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# ─── Stripe config ────────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID   = os.getenv("STRIPE_PRICE_ID")

if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
    raise RuntimeError("Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID in env")

stripe.api_key = STRIPE_SECRET_KEY

# ─── Request & Response Schemas ───────────────────────────────
class SubscriptionRequest(BaseModel):
    paymentMethodId: str
    planId:           str

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: datetime
    date_subscription_expires: datetime

# ─── Router ───────────────────────────────────────────────────
router = APIRouter(
    prefix="/subscription",
    tags=["subscription"],
)

@router.post(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK,
)
def create_subscription(
    payload: SubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session      = Depends(get_db),
):
    """
    1) Ensure we have a Stripe Customer for this user
    2) Attach the provided payment method
    3) Create the subscription on Stripe
    4) Persist subscription dates in your DB
    5) Return the subscription info
    """
    user = current_user
    logger.info(f"User {user.email} starting subscription flow")

    # 1) Customer
    if not user.stripe_customer_id:
        customer = stripe.Customer.create(
            email=user.email,
            name=user.full_name,
        )
        user.stripe_customer_id = customer.id
        db.commit()
    else:
        customer = stripe.Customer.retrieve(user.stripe_customer_id)

    # 2) Attach payment method
    try:
        stripe.PaymentMethod.attach(
            payload.paymentMethodId,
            customer=customer.id,
        )
        stripe.Customer.modify(
            customer.id,
            invoice_settings={"default_payment_method": payload.paymentMethodId},
        )
    except stripe.error.StripeError as e:
        logger.error("PaymentMethod attach failed", exc_info=True)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=e.user_message or str(e)
        )

    # 3) Create subscription
    try:
        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[{"price": payload.planId}],
            expand=["latest_invoice.payment_intent"],
        )
    except stripe.error.StripeError as e:
        logger.error("Subscription creation failed", exc_info=True)
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            detail=e.user_message or str(e)
        )

    # 4) Persist to your DB
    started = datetime.utcfromtimestamp(subscription.created)
    expires = datetime.utcfromtimestamp(subscription.current_period_end)

    user.subscribed                  = True
    user.date_subscribed             = started
    user.date_subscription_expires   = expires
    db.commit()

    logger.info(f"User {user.email} subscribed until {expires.isoformat()}")
    return SubscriptionResponse(
        subscribed=True,
        date_subscribed=started,
        date_subscription_expires=expires,
    )
