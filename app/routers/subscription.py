
import os
import logging
from datetime import datetime, timedelta

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User

# ─── Setup ────────────────────────────────────────────────
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# Load and validate Stripe keys
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_PUBLISHABLE_KEY = os.getenv("NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY", "").strip()
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "").strip()

if not STRIPE_SECRET_KEY or not STRIPE_PUBLISHABLE_KEY:
    raise RuntimeError("Stripe keys are required")

# Configure Stripe
stripe.api_key = STRIPE_SECRET_KEY
logger.info(f"Configured Stripe with key starting: {STRIPE_SECRET_KEY[:7]}...")

# ─── Models ───────────────────────────────────────────────

class StripeConfig(BaseModel):
    publishableKey: str
    priceId: str

class SubscriptionRequest(BaseModel):
    email: EmailStr
    paymentMethodId: str
    planId: str

class SubscriptionResponse(BaseModel):
    subscribed: bool
    date_subscribed: datetime | None
    date_subscription_expires: datetime | None
    requires_action: bool = False
    payment_intent_client_secret: str | None = None

# ─── Router ───────────────────────────────────────────────

router = APIRouter()

@router.get("/config", response_model=StripeConfig)
async def get_stripe_config():
    """Get Stripe configuration for frontend"""
    return StripeConfig(
        publishableKey=STRIPE_PUBLISHABLE_KEY,
        priceId=STRIPE_PRICE_ID
    )

@router.post("/", response_model=SubscriptionResponse)
async def create_subscription(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db)
):
    """Create a new subscription"""
    try:
        # Find user
        user = db.query(User).filter(User.email == payload.email).first()
        if not user:
            logger.error(f"User not found: {payload.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        logger.info(f"Processing subscription for {user.email}")

        # Create/get customer
        try:
            if not user.stripe_customer_id:
                customer = stripe.Customer.create(
                    email=user.email,
                    name=user.full_name,
                )
                user.stripe_customer_id = customer.id
                db.commit()
                logger.info(f"Created Stripe customer: {customer.id}")
            else:
                customer = stripe.Customer.retrieve(user.stripe_customer_id)
                logger.info(f"Using existing customer: {customer.id}")

        except stripe.error.StripeError as e:
            logger.error(f"Customer error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Customer error: {str(e)}"
            )

        # Attach payment method
        try:
            payment_method = stripe.PaymentMethod.attach(
                payload.paymentMethodId,
                customer=customer.id,
            )
            
            stripe.Customer.modify(
                customer.id,
                invoice_settings={
                    "default_payment_method": payment_method.id
                },
            )
            logger.info(f"Payment method {payment_method.id} attached to {customer.id}")

        except stripe.error.StripeError as e:
            logger.error(f"Payment method error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment error: {str(e)}"
            )

        # Create subscription
        try:
            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": payload.planId}],
                payment_behavior='default_incomplete',
                payment_settings={'save_default_payment_method': 'on_subscription'},
                expand=['latest_invoice'],
                metadata={'user_id': str(user.id)}
            )
            logger.info(f"Created subscription {subscription.id}")

            # Get the end date
            now = datetime.utcnow()
            try:
                period_end = subscription.current_period_end
                expires = datetime.utcfromtimestamp(period_end)
            except (AttributeError, TypeError):
                expires = now + timedelta(days=30)
                logger.warning("Using default expiration period of 30 days")

            # Check if additional action is needed
            if subscription.status == 'incomplete':
                logger.info("Subscription requires additional action")
                latest_invoice = subscription.latest_invoice
                payment_intent = latest_invoice.payment_intent if latest_invoice else None
                
                if payment_intent and payment_intent.status == 'requires_action':
                    return SubscriptionResponse(
                        subscribed=False,
                        date_subscribed=None,
                        date_subscription_expires=None,
                        requires_action=True,
                        payment_intent_client_secret=payment_intent.client_secret
                    )

            # Update user record
            user.subscribed = True
            user.date_subscribed = now
            user.date_subscription_expires = expires
            db.commit()
            
            logger.info(f"Updated user subscription status. Expires: {expires}")

            return SubscriptionResponse(
                subscribed=True,
                date_subscribed=now,
                date_subscription_expires=expires,
                requires_action=False,
                payment_intent_client_secret=None
            )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription creation error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subscription error: {str(e)}"
            )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

@router.get("/test-stripe")
async def test_stripe():
    """Test Stripe configuration"""
    try:
        account = stripe.Account.retrieve()
        return {
            "status": "ok",
            "account": account.id,
            "publishable_key_starts_with": STRIPE_PUBLISHABLE_KEY[:7],
            "price_id": STRIPE_PRICE_ID
        }
    except stripe.error.StripeError as e:
        return {"status": "error", "message": str(e)}
