# app/routers/subscription.py

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

import stripe

from ..database import get_db
from ..models import User
from app.routers.auth import get_current_user  # your existing auth dependency

# ─── Configure logging ──────────────────────────────────────────
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)
handler = logging.StreamHandler()
handler.setFormatter(logging.Formatter("[%(asctime)s] %(levelname)s %(name)s: %(message)s"))
logger.addHandler(handler)

# ─── Load & log your env vars ──────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID   = os.getenv("STRIPE_PRICE_ID")

# Log the values we actually have (first/last few chars only for safety)
logger.info(f"Loaded STRIPE_SECRET_KEY={STRIPE_SECRET_KEY[:8] + '…' if STRIPE_SECRET_KEY else None}")
logger.info(f"Loaded STRIPE_PRICE_ID={STRIPE_PRICE_ID}")

if not STRIPE_SECRET_KEY:
    logger.error("Missing STRIPE_SECRET_KEY env var")
    raise RuntimeError("Missing STRIPE_SECRET_KEY env var")
if not STRIPE_PRICE_ID:
    logger.error("Missing STRIPE_PRICE_ID env var")
    raise RuntimeError("Missing STRIPE_PRICE_ID env var")

stripe.api_key = STRIPE_SECRET_KEY

# ─── Router setup ─────────────────────────────────────────────
router = APIRouter(tags=["subscription"]) 


class SubscriptionRequest(BaseModel):
    paymentMethodId: str
    planId: str  # still accept planId from client for now


class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: str
    date_subscription_expires: str


@router.post(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK,
)
def create_or_update_subscription(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"→ Starting subscription for user {current_user.email}")

    try:
        # 1) Ensure Stripe Customer exists
        if not current_user.stripe_customer_id:
            logger.info("   • Creating new Stripe customer")
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        else:
            logger.info(f"   • Retrieving Stripe customer {current_user.stripe_customer_id}")
            customer = stripe.Customer.retrieve(current_user.stripe_customer_id)

        # 2) Attach payment method & set default
        logger.info(f"   • Attaching payment method {payload.paymentMethodId}")
        stripe.PaymentMethod.attach(payload.paymentMethodId, customer=customer.id)
        stripe.Customer.modify(customer.id, invoice_settings={"default_payment_method": payload.paymentMethodId})

        # 3) Create subscription
        logger.info(f"   • Creating subscription with price {payload.planId}")
        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[{"price": payload.planId}],
            expand=["latest_invoice.payment_intent"],
        )

        # 4) Persist in DB
        now = datetime.utcfromtimestamp(subscription.created)
        expires = datetime.utcfromtimestamp(subscription.current_period_end)

        current_user.subscribed = True
        current_user.date_subscribed = now
        current_user.date_subscription_expires = expires
        db.commit()

        logger.info("✅ Subscription recorded in DB")
        return SubscriptionResponse(
            subscribed=True,
            date_subscribed=now.isoformat(),
            date_subscription_expires=expires.isoformat(),
        )

    except stripe.error.StripeError as e:
        logger.error(f"StripeError: {e.user_message or e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.user_message or "Stripe error during subscription",
        )
    except Exception as e:
        logger.exception("Unexpected error in subscription endpoint")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error during subscription",
        )


@router.get(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK,
)
def fetch_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info(f"→ Fetching subscription status for {current_user.email}")
    if not current_user.subscribed:
        logger.info("   • No active subscription")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )

    return SubscriptionResponse(
        subscribed=True,
        date_subscribed=current_user.date_subscribed.isoformat(),
        date_subscription_expires=current_user.date_subscription_expires.isoformat(),
    )
