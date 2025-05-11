# app/routers/subscription.py

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

# Logging setup
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# Stripe config
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is required")

stripe.api_key = STRIPE_SECRET_KEY

class SubscriptionRequest(BaseModel):
    paymentMethodId: str
    planId: str
    email: str  # Add email to match your frontend

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: datetime | None
    date_subscription_expires: datetime | None
    access_token: str  # Add access token to response

router = APIRouter()

@router.get("/")
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check subscription status"""
    try:
        if not current_user.subscribed:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No active subscription"
            )
        
        return {
            "subscribed": current_user.subscribed,
            "date_subscribed": current_user.date_subscribed,
            "date_subscription_expires": current_user.date_subscription_expires
        }
    except Exception as e:
        logger.error(f"Error checking subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check subscription status"
        )

@router.post("/create", response_model=SubscriptionResponse)
async def create_subscription(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db)
):
    """Create a new subscription"""
    try:
        # Get user from email
        user = db.query(User).filter(User.email == payload.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        logger.info(f"Creating subscription for user {user.email}")

        # Create or get Stripe customer
        if not user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=user.email,
                name=user.full_name,
            )
            user.stripe_customer_id = customer.id
            db.commit()
        else:
            customer = stripe.Customer.retrieve(user.stripe_customer_id)

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
                payment_settings={'save_default_payment_method': 'on_subscription'},
                expand=['latest_invoice.payment_intent'],
            )
        except stripe.error.StripeError as e:
            logger.error(f"Subscription error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        # Update user subscription status
        now = datetime.utcnow()
        expires = datetime.utcfromtimestamp(subscription.current_period_end)
        
        user.subscribed = True
        user.date_subscribed = now
        user.date_subscription_expires = expires
        db.commit()

        # Generate new access token
        access_token = create_access_token({"sub": user.email})

        logger.info(f"Subscription created for {user.email}")

        return SubscriptionResponse(
            subscribed=True,
            date_subscribed=now,
            date_subscription_expires=expires,
            access_token=access_token
        )

    except Exception as e:
        logger.error(f"Subscription creation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )
