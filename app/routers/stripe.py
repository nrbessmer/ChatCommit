# app/routers/stripe.py

import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from ..routers.auth import get_current_user

# initialize Stripe with your secret key
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(tags=["stripe"])

@router.post("/create-checkout-session")
def create_checkout_session(
    user: User = Depends(get_current_user),
):
    success_url = os.getenv("SUCCESS_URL")
    cancel_url  = os.getenv("CANCEL_URL")

    if not success_url or not cancel_url:
        raise HTTPException(
            status_code=500,
            detail="Payment URLs not configured on the server."
        )

    session = stripe.checkout.Session.create(
        customer_email=user.email,
        payment_method_types=["card"],
        line_items=[{"price": os.getenv("STRIPE_PRICE_ID"), "quantity": 1}],
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
    sig_header = request.headers.get("stripe-signature")
    webhook_secret = os.getenv("STRIPE_WEBHOOK_SECRET")

    if not webhook_secret:
        raise HTTPException(
            status_code=500,
            detail="Webhook secret is not configured on the server."
        )

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, webhook_secret
        )
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid Stripe signature")

    # When payment is successful, mark the user as subscribed
    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        customer_email = session.get("customer_email")
        user = db.query(User).filter(User.email == customer_email).first()
        if user:
            user.subscribed = True
            user.date_subscribed = stripe.util.convert_to_datetime(session.created)
            # set expiry based on your plan (e.g. 30 days)
            from datetime import timedelta, datetime
            user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
            db.commit()

    return {"status": "success"}
