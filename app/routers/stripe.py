# app/routers/stripe.py

import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..routers.auth import get_current_user

router = APIRouter(prefix="/stripe", tags=["stripe"])

# configure stripe SECRET key for server‑side calls
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID    = os.getenv("STRIPE_PRICE_ID")  # or whatever your env var is
if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
    raise RuntimeError("Stripe secret key or price ID not set in env")

stripe.api_key = STRIPE_SECRET_KEY


@router.get("/config")
def stripe_config():
    """
    Public config for client-side Stripe.js initialization.
    """
    publishable = os.getenv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY")
    if not publishable:
        raise HTTPException(500, "Publishable key not configured")
    return {
        "publishableKey": publishable,
        "priceId": STRIPE_PRICE_ID,
    }


@router.post("/create-checkout-session")
def create_checkout_session(
    user: User = Depends(get_current_user),
):
    success_url = os.getenv("SUCCESS_URL") or ""
    cancel_url  = os.getenv("CANCEL_URL") or ""
    if not success_url or not cancel_url:
        raise HTTPException(500, "Payment URLs not configured")

    session = stripe.checkout.Session.create(
        customer_email=user.email,
        payment_method_types=["card"],
        line_items=[{"price": STRIPE_PRICE_ID, "quantity": 1}],
        mode="subscription",
        success_url=success_url,
        cancel_url=cancel_url,
    )
    return {"url": session.url}


@router.post("/webhook")
async def stripe_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not webhook_secret:
        raise HTTPException(500, "Webhook secret not configured")

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, webhook_secret)
    except stripe.error.SignatureVerificationError:
        raise HTTPException(400, "Invalid Stripe signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        email = session.get("customer_email")
        user = db.query(User).filter(User.email == email).first()
        if user:
            from datetime import datetime, timedelta
            user.subscribed = True
            user.date_subscribed = datetime.utcnow()
            user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
            db.commit()

    return {"status": "success"}
