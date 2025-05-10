# app/routers/stripe.py

import os
import logging
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..routers.auth import get_current_user

# ─── Logging setup ────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ─── Load and validate your Stripe keys ───────────────────
STRIPE_SECRET = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE = os.getenv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")
SUCCESS_URL = os.getenv("SUCCESS_URL")
CANCEL_URL  = os.getenv("CANCEL_URL")
WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")

if not STRIPE_SECRET:
    logger.error("STRIPE_SECRET_KEY not set in environment!")
    raise RuntimeError("Missing STRIPE_SECRET_KEY")
stripe.api_key = STRIPE_SECRET
logger.info(f"Loaded Stripe secret key: {STRIPE_SECRET[:4]}…")

if not STRIPE_PRICE_ID:
    logger.error("STRIPE_PRICE_ID not set")
    raise RuntimeError("Missing STRIPE_PRICE_ID")

if not SUCCESS_URL or not CANCEL_URL:
    logger.error(f"Payment URLs not configured: SUCCESS_URL={SUCCESS_URL}, CANCEL_URL={CANCEL_URL}")
    # we’ll still start, but will reject calls
router = APIRouter(tags=["stripe"])


@router.post("/create-checkout-session")
def create_checkout_session(
    user: User = Depends(get_current_user),
):
    """
    Creates a new Stripe Checkout Session for a subscription.
    Requires:
     - SUCCESS_URL
     - CANCEL_URL
     - STRIPE_PRICE_ID
     - valid STRIPE_SECRET_KEY
    """
    if not SUCCESS_URL or not CANCEL_URL:
        raise HTTPException(
            status_code=500,
            detail="Payment URLs not configured on the server."
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
    Endpoint to receive Stripe webhooks. Verifies signature and,
    on successful checkout.session.completed, marks the user as subscribed.
    """
    if not WEBHOOK_SECRET:
        raise HTTPException(
            status_code=500,
            detail="Webhook secret is not configured on the server."
        )

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    # Handle the completed checkout session
    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        customer_email = session_obj.get("customer_email")
        if customer_email:
            user = db.query(User).filter(User.email == customer_email).first()
            if user:
                user.subscribed = True
                # Stripe returns `created` as a Unix timestamp
                from datetime import datetime, timedelta
                ts = session_obj["created"]
                user.date_subscribed = datetime.utcfromtimestamp(ts)
                # e.g. 30 days from now
                user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
                db.commit()
                logger.info(f"User {customer_email} marked subscribed via webhook.")

    return {"status": "success"}
