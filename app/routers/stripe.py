import os
import stripe
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from ..database import get_db
from ..models import User
from ..routers.auth import get_current_user

stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(tags=["payments"])

@router.post("/create-checkout-session")
def create_checkout(user: User = Depends(get_current_user)):
    session = stripe.checkout.Session.create(
        customer_email=user.email,
        payment_method_types=["card"],
        line_items=[{"price": os.getenv("STRIPE_PRICE_ID"), "quantity": 1}],
        mode="subscription",
        success_url=os.getenv("DOMAIN") + "/success",
        cancel_url=os.getenv("DOMAIN") + "/cancel",
    )
    return {"url": session.url}

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):  # ✅ now async
    payload = await request.body()  # ✅ no longer invalid
    sig_header = request.headers.get("stripe-signature")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, os.getenv("STRIPE_ENDPOINT_SECRET"))
    except stripe.error.SignatureVerificationError:
        raise HTTPException(status_code=400, detail="Invalid signature")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        # TODO: mark user as subscribed in DB

    return {"status": "success"}
