# app/routers/stripe.py

import os
import logging
from datetime import datetime, timedelta

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..routers.auth import get_current_user

logger = logging.getLogger(__name__)

# ─── Configuration ────────────────────────────────────
STRIPE_SECRET_KEY       = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PUBLISHABLE_KEY  = os.getenv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
STRIPE_PRICE_ID         = os.getenv("STRIPE_PRICE_ID")
SUCCESS_URL             = os.getenv("SUCCESS_URL")
CANCEL_URL              = os.getenv("CANCEL_URL")
STRIPE_WEBHOOK_SECRET   = os.getenv("STRIPE_WEBHOOK_SECRET")

_missing = [k for k,v in {
    "STRIPE_SECRET_KEY":       STRIPE_SECRET_KEY,
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY": STRIPE_PUBLISHABLE_KEY,
    "STRIPE_PRICE_ID":         STRIPE_PRICE_ID,
    "SUCCESS_URL":             SUCCESS_URL,
    "CANCEL_URL":              CANCEL_URL,
    "STRIPE_WEBHOOK_SECRET":   STRIPE_WEBHOOK_SECRET,
}.items() if not v]
if _missing:
    # At import time, will log but not crash the whole app
    logger.error(f"Missing required Stripe env var(s): {', '.join(_missing)}")

# initialize the Stripe library
if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY
    logger.info(f"Stripe secret key loaded (prefix={STRIPE_SECRET_KEY[:4]}**)")
else:
    logger.warning("Stripe secret key not set; payments won’t work.")

router = APIRouter(tags=["stripe"])


@router.post("/create-checkout-session")
def create_checkout_session(
    user: User = Depends(get_current_user),
):
    # ensure everything’s there
    if not STRIPE_SECRET_KEY:
        raise HTTPException(500, "Server misconfiguration: missing STRIPE_SECRET_KEY")
    if not STRIPE_PRICE_ID:
        raise HTTPException(500, "Server misconfiguration: missing STRIPE_PRICE_ID")
    if not SUCCESS_URL or not CANCEL_URL:
        raise HTTPException(500, "Server misconfiguration: missing SUCCESS_URL/CANCEL_URL")

    # build the session
    try:
        session = stripe.checkout.Session.create(
            customer_email=user.email,
            payment_method_types=["card"],
            line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
            mode="subscription",
            success_url=SUCCESS_URL,
            cancel_url=CANCEL_URL,
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe API error when creating checkout session: {e.user_message or str(e)}")
        raise HTTPException(502, f"Payment gateway error: {e.user_message or 'please try again'}")

    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(500, "Server misconfiguration: missing STRIPE_WEBHOOK_SECRET")

    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except stripe.error.SignatureVerificationError:
        logger.error("Invalid Stripe webhook signature")
        raise HTTPException(400, "Invalid Stripe signature")
    except Exception as e:
        logger.error(f"Error parsing Stripe webhook: {e}")
        raise HTTPException(400, "Invalid payload")

    # handle checkout completion
    if event["type"] == "checkout.session.completed":
        session_obj = event["data"]["object"]
        customer_email = session_obj.get("customer_email")
        logger.info(f"Webhook: checkout.session.completed for {customer_email}")

        user = db.query(User).filter(User.email == customer_email).first()
        if user:
            user.subscribed = True
            user.date_subscribed = datetime.utcfromtimestamp(session_obj["created"])
            user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
            db.commit()
        else:
            logger.warning(f"No user found for email {customer_email} on webhook")

    return {"status": "success"}
