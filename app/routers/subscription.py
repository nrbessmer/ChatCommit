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
from .auth import get_current_user

# Logging setup
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# Stripe config
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is required")

stripe.api_key = STRIPE_SECRET_KEY

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: datetime | None
    date_subscription_expires: datetime | None

router = APIRouter()

@router.get(
    "/",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK
)
async def get_subscription(
    current_user: User = Depends(get_current_user)
):
    """Get current user's subscription status"""
    logger.info(f"Checking subscription for user {current_user.email}")
    
    # Check if subscription is expired
    if (current_user.subscribed and
        current_user.date_subscription_expires and
        current_user.date_subscription_expires < datetime.utcnow()):
        current_user.subscribed = False
        db = next(get_db())
        db.commit()
        logger.info(f"Subscription expired for user {current_user.email}")

    return SubscriptionResponse(
        subscribed=current_user.subscribed,
        date_subscribed=current_user.date_subscribed,
        date_subscription_expires=current_user.date_subscription_expires
    )

@router.post(
    "/cancel",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK
)
async def cancel_subscription(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cancel user's subscription"""
    try:
        logger.info(f"Canceling subscription for user {current_user.email}")

        if not current_user.subscribed:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No active subscription to cancel"
            )

        # If user has a Stripe subscription, cancel it
        if current_user.stripe_customer_id:
            try:
                subscriptions = stripe.Subscription.list(
                    customer=current_user.stripe_customer_id,
                    status="active"
                )
                
                for subscription in subscriptions.data:
                    stripe.Subscription.delete(subscription.id)
            except stripe.error.StripeError as e:
                logger.error(f"Stripe error while canceling: {str(e)}")
                # Continue with local cancellation even if Stripe fails

        # Update local subscription status
        current_user.subscribed = False
        current_user.date_subscription_expires = datetime.utcnow()
        db.commit()

        logger.info(f"Subscription canceled for user {current_user.email}")

        return SubscriptionResponse(
            subscribed=False,
            date_subscribed=current_user.date_subscribed,
            date_subscription_expires=current_user.date_subscription_expires
        )

    except Exception as e:
        logger.error(f"Error canceling subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription"
        )

@router.post(
    "/check-status",
    response_model=SubscriptionResponse,
    status_code=status.HTTP_200_OK
)
async def check_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Check and update subscription status from Stripe"""
    try:
        logger.info(f"Checking Stripe subscription for user {current_user.email}")

        if not current_user.stripe_customer_id:
            return SubscriptionResponse(
                subscribed=current_user.subscribed,
                date_subscribed=current_user.date_subscribed,
                date_subscription_expires=current_user.date_subscription_expires
            )

        # Check Stripe subscription status
        try:
            subscriptions = stripe.Subscription.list(
                customer=current_user.stripe_customer_id,
                status="active"
            )
            
            has_active = False
            latest_end = None
            
            for subscription in subscriptions.data:
                if subscription.status == "active":
                    has_active = True
                    end_date = datetime.utcfromtimestamp(subscription.current_period_end)
                    if not latest_end or end_date > latest_end:
                        latest_end = end_date

            # Update local status if different
            if has_active != current_user.subscribed:
                current_user.subscribed = has_active
                if has_active:
                    current_user.date_subscription_expires = latest_end
                db.commit()
                logger.info(f"Updated subscription status for {current_user.email}: {has_active}")

        except stripe.error.StripeError as e:
            logger.error(f"Stripe error checking status: {str(e)}")
            # Continue with current local status

        return SubscriptionResponse(
            subscribed=current_user.subscribed,
            date_subscribed=current_user.date_subscribed,
            date_subscription_expires=current_user.date_subscription_expires
        )

    except Exception as e:
        logger.error(f"Error checking subscription status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to check subscription status"
        )
