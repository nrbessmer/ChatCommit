import os
import logging
from datetime import datetime

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from .auth import get_current_user, create_access_token

# ─── Logging Setup ──────────────────────────────────────────
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# Add handler if none exists
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

# ─── Stripe Config ──────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID")

if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is required")
if not STRIPE_PRICE_ID:
    raise RuntimeError("STRIPE_PRICE_ID is required")

stripe.api_key = STRIPE_SECRET_KEY

# ─── Models ───────────────────────────────────────────────

class SubscriptionRequest(BaseModel):
    paymentMethodId: str
    planId: str

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: datetime | None
    date_subscription_expires: datetime | None
    access_token: str

# ─── Router ───────────────────────────────────────────────

router = APIRouter()

@router.get("/", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current subscription status"""
    try:
        logger.info(f"Checking subscription for user {current_user.email}")
        
        # Always generate fresh token
        new_token = create_access_token({"sub": current_user.email})
        
        return SubscriptionResponse(
            subscribed=current_user.subscribed,
            date_subscribed=current_user.date_subscribed,
            date_subscription_expires=current_user.date_subscription_expires,
            access_token=new_token
        )
    except Exception as e:
        logger.error(f"Error checking subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check subscription status"
        )

@router.post("/", response_model=SubscriptionResponse)
async def create_subscription(
    payload: SubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new subscription"""
    try:
        logger.info(f"Creating subscription for user {current_user.email}")

        # Create or get Stripe customer
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
            logger.info(f"Created new Stripe customer: {customer.id}")
        else:
            customer = stripe.Customer.retrieve(current_user.stripe_customer_id)
            logger.info(f"Using existing Stripe customer: {customer.id}")

        # Attach payment method
        try:
            payment_method = stripe.PaymentMethod.attach(
                payload.paymentMethodId,
                customer=customer.id,
            )
            
            # Set as default payment method
            stripe.Customer.modify(
                customer.id,
                invoice_settings={
                    "default_payment_method": payment_method.id
                },
            )
            logger.info(f"Payment method attached: {payment_method.id}")
            
        except stripe.error.StripeError as e:
            logger.error(f"Payment method error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # Create subscription
        try:
            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": payload.planId}],
                payment_behavior='default_incomplete',
                expand=['latest_invoice.payment_intent']
            )
            logger.info(f"Subscription created: {subscription.id}")
            
        except stripe.error.StripeError as e:
            logger.error(f"Subscription creation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # Update user subscription status
        now = datetime.utcnow()
        expires = datetime.utcfromtimestamp(subscription.current_period_end)
        
        current_user.subscribed = True
        current_user.date_subscribed = now
        current_user.date_subscription_expires = expires
        db.commit()
        
        logger.info(f"User {current_user.email} subscription updated in database")

        # Generate fresh token
        new_token = create_access_token({"sub": current_user.email})

        return SubscriptionResponse(
            subscribed=True,
            date_subscribed=now,
            date_subscription_expires=expires,
            access_token=new_token
        )

    except Exception as e:
        logger.error(f"Subscription error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )
