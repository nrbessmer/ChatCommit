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

# Logging
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

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: datetime | None
    date_subscription_expires: datetime | None

router = APIRouter()

@router.get("/", response_model=SubscriptionResponse)
async def get_subscription(
    current_user: User = Depends(get_current_user)
):
    """Get current subscription status"""
    logger.info(f"Checking subscription for {current_user.email}")
    
    return SubscriptionResponse(
        subscribed=current_user.subscribed,
        date_subscribed=current_user.date_subscribed,
        date_subscription_expires=current_user.date_subscription_expires
    )

@router.post("/", response_model=SubscriptionResponse)
async def create_subscription(
    payload: SubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create or update subscription"""
    try:
        logger.info(f"Creating subscription for {current_user.email}")

        # Create or get Stripe customer
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        else:
            customer = stripe.Customer.retrieve(current_user.stripe_customer_id)

        # Attach payment method
        try:
            payment_method = stripe.PaymentMethod.attach(
                payload.paymentMethodId,
                customer=customer.id
            )
            
            # Set as default payment method
            stripe.Customer.modify(
                customer.id,
                invoice_settings={
                    "default_payment_method": payment_method.id
                }
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
                expand=['latest_invoice.payment_intent']
            )

            # Handle subscription status
            if subscription.status == "active":
                current_user.subscribed = True
                current_user.date_subscribed = datetime.utcnow()
                current_user.date_subscription_expires = datetime.utcfromtimestamp(
                    subscription.current_period_end
                )
                db.commit()
                
                logger.info(f"Subscription activated for {current_user.email}")
            else:
                logger.warning(f"Subscription status: {subscription.status}")
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Subscription status: {subscription.status}"
                )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=str(e)
            )

        return SubscriptionResponse(
            subscribed=current_user.subscribed,
            date_subscribed=current_user.date_subscribed,
            date_subscription_expires=current_user.date_subscription_expires
        )

    except Exception as e:
        logger.error(f"Subscription creation error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )
