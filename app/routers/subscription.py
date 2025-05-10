# app/routers/subscription.py
import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status, FastAPI
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime

import stripe

from ..database import get_db
from ..models import User
from app.routers.auth import get_current_user

logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_PRICE_ID   = os.getenv("STRIPE_PRICE_ID", "")

if not STRIPE_SECRET_KEY or not STRIPE_PRICE_ID:
    # We'll still let the app start so we can see a clear log message
    logger.error("❌ STRIPE_SECRET_KEY or STRIPE_PRICE_ID is missing!")

stripe.api_key = STRIPE_SECRET_KEY

router = APIRouter(prefix="/subscription", tags=["subscription"])

class SubscriptionRequest(BaseModel):
    paymentMethodId: str

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: str
    date_subscription_expires: str

@router.post("/", response_model=SubscriptionResponse, status_code=status.HTTP_200_OK)
def create_or_update_subscription(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    logger.info("📥 Received subscription request for %s", current_user.email)
    # ... rest of your handler ...
    return SubscriptionResponse(
        subscribed=True,
        date_subscribed="…",
        date_subscription_expires="…",
    )

@router.get("/", response_model=SubscriptionResponse)
def fetch_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # ... your existing GET handler ...
    pass

# Now we register a startup event on the main app to log what we've loaded:
def register_subscription_startup(app: FastAPI):
    @app.on_event("startup")
    def _log_stripe_config():
        logger.info("▶︎ Loaded STRIPE_SECRET_KEY: %s…", STRIPE_SECRET_KEY[:8])
        logger.info("▶︎ Loaded STRIPE_PRICE_ID: %s", STRIPE_PRICE_ID)

# Export both router and the startup hook
__all__ = ["router", "register_subscription_startup"]
