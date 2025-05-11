import os
import logging
from datetime import datetime

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from .auth import get_current_user

# ─── Logging Setup ──────────────────────────────────────────
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# ─── Stripe Config ──────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")

if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
    raise RuntimeError("Missing STRIPE_SECRET_KEY or STRIPE_PRICE_ID in env")

stripe.api_key = STRIPE_SECRET_KEY

# ─── Models ───────────────────────────────────────────────

class SubscriptionRequest(BaseModel):
    paymentMethodId: str
    planId: str

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: datetime
    date_subscription_expires: datetime

# ─── Router ───────────────────────────────────────────────

router = APIRouter()

@router.post(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK,
)
async def create_subscription(
    payload: SubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new subscription for the authenticated user"""
    try:
        logger.info(f"Processing subscription for user {current_user.email}")

        # 1) Ensure Stripe customer
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        else:
            customer = stripe.Customer.retrieve(current_user.stripe_customer_id)

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
            logger.error(f"Payment method error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # 3) Create subscription
        try:
            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": payload.planId}],
                expand=["latest_invoice.payment_intent"],
            )
        except stripe.error.StripeError as e:
            logger.error(f"Subscription creation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # 4) Update user subscription status
        started = datetime.utcfromtimestamp(subscription.created)
        expires = datetime.utcfromtimestamp(subscription.current_period_end)

        current_user.subscribed = True
        current_user.date_subscribed = started
        current_user.date_subscription_expires = expires
        db.commit()

        logger.info(f"Subscription created successfully for {current_user.email}")

        return SubscriptionResponse(
            subscribed=True,
            date_subscribed=started,
            date_subscription_expires=expires,
        )

    except Exception as e:
        logger.error(f"Subscription error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred processing the subscription"
        )
