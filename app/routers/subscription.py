# app/routers/subscription.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
import stripe
import os

from ..database import get_db
from ..models import User
from app.routers.commit import get_current_user  # your existing auth dependency

# Initialize Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/subscription", tags=["subscription"])


class SubscriptionRequest(BaseModel):
    paymentMethodId: str
    planId: str  # e.g. 'price_1Hh1YF...'


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
    """
    Create a new subscription or update an existing one for the authenticated user.
    """
    try:
        # 1) Ensure Stripe Customer exists
        if not current_user.stripe_customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name,
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        else:
            customer = stripe.Customer.retrieve(current_user.stripe_customer_id)

        # 2) Attach payment method to customer and set default
        stripe.PaymentMethod.attach(
            payload.paymentMethodId,
            customer=customer.id,
        )
        stripe.Customer.modify(
            customer.id,
            invoice_settings={"default_payment_method": payload.paymentMethodId},
        )

        # 3) Create or update the subscription
        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[{"price": payload.planId}],
            expand=["latest_invoice.payment_intent"],
        )

        # 4) Persist subscription status in your DB
        current_user.subscribed = True
        current_user.date_subscribed = datetime.utcfromtimestamp(subscription.created)
        current_user.date_subscription_expires = datetime.utcfromtimestamp(
            subscription.current_period_end
        )
        db.commit()

        return SubscriptionResponse(
            subscribed=True,
            date_subscribed=current_user.date_subscribed.isoformat(),
            date_subscription_expires=current_user.date_subscription_expires.isoformat(),
        )

    except stripe.error.StripeError as e:
        # Bubble up Stripe errors with user-friendly message
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=e.user_message or "Stripe error during subscription",
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error: {e}",
        )


@router.get("/", response_model=SubscriptionResponse, status_code=status.HTTP_200_OK)
def fetch_subscription_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Get the current subscription status for the authenticated user.
    """
    if not current_user.subscribed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active subscription found",
        )

    return SubscriptionResponse(
        subscribed=True,
        date_subscribed=current_user.date_subscribed.isoformat(),
        date_subscription_expires=current_user.date_subscription_expires.isoformat(),
    )
