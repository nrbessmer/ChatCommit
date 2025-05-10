# app/routers/stripe.py

import os
import stripe
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..routers.auth import get_current_user

# configure logger
logger = logging.getLogger("stripe")
logger.setLevel(logging.INFO)

# load env vars
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY = os.getenv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
SUCCESS_URL = os.getenv("SUCCESS_URL")
CANCEL_URL = os.getenv("CANCEL_URL")

# sanity checks
if not STRIPE_SECRET_KEY:
    raise RuntimeError("Missing STRIPE_SECRET_KEY")
if not STRIPE_PUBLISHABLE_KEY:
    raise RuntimeError("Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
if not STRIPE_PRICE_ID:
    raise RuntimeError("Missing STRIPE_PRICE_ID")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/stripe", tags=["stripe"])


class StripeConfigOut(BaseModel):
    publishableKey: str
    priceId: str


@router.get("/config", response_model=StripeConfigOut)
def get_stripe_config():
    """
    Returns the publishable key and the price ID so the frontend
    can initialize stripe.js.
    """
    logger.info("Providing Stripe config to frontend")
    return StripeConfigOut(
        publishableKey=STRIPE_PUBLISHABLE_KEY,
        priceId=STRIPE_PRICE_ID,
    )


@router.post("/create-checkout-session")
def create_checkout_session(
    user: User = Depends(get_current_user),
):
    """
    Creates a Stripe Checkout Session for a subscription.
    """
    if not SUCCESS_URL or not CANCEL_URL:
        raise HTTPException(
            status_code=500,
            detail="SUCCESS_URL or CANCEL_URL not configured"
        )

    session = stripe.checkout.Session.create(
        customer_email=user.email,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        mode="subscription",
        success_url=SUCCESS_URL,
        cancel_url=CANCEL_URL,
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Receives Stripe webhook events.
    """
    if not WEBHOOK_SECRET:
        raise HTTPException(500, "Missing STRIPE_WEBHOOK_SECRET")

    payload = await request.body()
    sig = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig, WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, detail="Invalid Stripe signature")

    # handle successful checkout
    if event["type"] == "checkout.session.completed":
        sess = event["data"]["object"]
        email = sess.get("customer_email")
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.subscribed = True
            # mark subscription dates however you like...
            from datetime import datetime, timedelta
            user.date_subscribed = datetime.utcnow()
            user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
            db.commit()
            logger.info(f"User {email} marked as subscribed")

    return {"status": "success"}
