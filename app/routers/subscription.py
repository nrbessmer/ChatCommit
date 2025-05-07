from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from ..database import get_db
from ..models import User
from app.routers.commit import get_current_user
import stripe
import os

# Set your Stripe secret key from environment variable
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

router = APIRouter(prefix="/subscription", tags=["subscription"])

# Pydantic input model
class SubscriptionRequest(BaseModel):
    paymentMethodId: str
    planId: str  # e.g. 'price_1Hh1YF...'

# Pydantic output model
class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: str
    date_subscription_expires: str

@router.post("/", response_model=SubscriptionResponse)
def create_or_update_subscription(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        # Step 1: Attach payment method to customer
        customer_id = current_user.stripe_customer_id
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name
            )
            current_user.stripe_customer_id = customer.id
            db.commit()
        else:
            customer = stripe.Customer.retrieve(customer_id)

        # Step 2: Create subscription
        subscription = stripe.Subscription.create(
            customer=customer.id,
            items=[{"price": payload.planId}],
            default_payment_method=payload.paymentMethodId,
            expand=["latest_invoice.payment_intent"]
        )

        # Step 3: Update DB (you can store fields as needed)
        current_user.subscribed = True
        db.commit()

        return SubscriptionResponse(
            subscribed=True,
            date_subscribed=str(subscription.created),
            date_subscription_expires=str(subscription.current_period_end)
        )

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Subscription failed: {e}")

