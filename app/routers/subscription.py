import os
import logging
from datetime import datetime, timedelta

import stripe
from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from ..database import get_db
from ..models import User
from app.routers.auth import get_current_user

# ─── Setup ────────────────────────────────────────────────
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)

# Add handler if none exists
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
    logger.addHandler(handler)

# ─── Stripe Config ──────────────────────────────────────────
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_PRICE_ID = os.getenv("STRIPE_PRICE_ID", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is required")
if not STRIPE_PRICE_ID:
    raise RuntimeError("STRIPE_PRICE_ID is required")

stripe.api_key = STRIPE_SECRET_KEY
logger.info(f"Configured Stripe with key starting: {STRIPE_SECRET_KEY[:7]}...")

# ─── Models ───────────────────────────────────────────────

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

    class Config:
        from_attributes = True

# ─── Router ───────────────────────────────────────────────

router = APIRouter()

@router.get("/", response_model=SubscriptionResponse)
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get current subscription status"""
    try:
        logger.info(f"Checking subscription status for {current_user.email}")
        
        # Check if there's an incomplete subscription that needs payment confirmation
        if not current_user.subscribed and current_user.stripe_customer_id:
            try:
                # Look for any incomplete subscriptions
                subscriptions = stripe.Subscription.list(
                    customer=current_user.stripe_customer_id,
                    status='incomplete',
                    limit=1
                )
                
                if subscriptions and subscriptions.data:
                    sub = subscriptions.data[0]
                    logger.info(f"Found incomplete subscription: {sub.id}")
                    
                    # Get the invoice and payment intent
                    if sub.latest_invoice:
                        invoice = stripe.Invoice.retrieve(sub.latest_invoice)
                        if invoice.payment_intent:
                            payment_intent = stripe.PaymentIntent.retrieve(invoice.payment_intent)
                            if payment_intent.status == 'requires_action' or payment_intent.status == 'requires_confirmation':
                                logger.info(f"Payment intent {payment_intent.id} requires action")
                                return SubscriptionResponse(
                                    subscribed=False,
                                    date_subscribed=None,
                                    date_subscription_expires=None,
                                    requires_action=True,
                                    payment_intent_client_secret=payment_intent.client_secret
                                )
            except Exception as e:
                logger.error(f"Error checking incomplete subscriptions: {str(e)}")
                # Continue to return normal status
        
        return SubscriptionResponse(
            subscribed=current_user.subscribed,
            date_subscribed=current_user.date_subscribed,
            date_subscription_expires=current_user.date_subscription_expires,
            requires_action=False,
            payment_intent_client_secret=None
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
            logger.info("Attaching payment method")
            payment_method = stripe.PaymentMethod.attach(
                payload.paymentMethodId,
                customer=customer.id,
            )
            
            logger.info("Setting as default payment method")
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
                detail=f"Payment error: {str(e)}"
            )

        # Create subscription
        try:
            logger.info("Creating subscription")
            
            # Create subscription WITHOUT any expand parameters
            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": payload.planId}],
                payment_behavior='default_incomplete',
                payment_settings={'save_default_payment_method': 'on_subscription'},
                metadata={'user_id': str(user.id)}
            )
            
            logger.info(f"Created subscription: {subscription.id}")
            logger.info(f"Subscription details: id={subscription.id}, status={subscription.status}")
            
            # For debugging
            subscription_data = {k: v for k, v in subscription.items() if not k.startswith('_')}
            logger.info(f"Subscription data: {subscription_data}")

            # If we have an invoice, retrieve it separately
            payment_intent_client_secret = None
            requires_action = False
            payment_intent = None
            
            if subscription.latest_invoice:
                try:
                    invoice = stripe.Invoice.retrieve(subscription.latest_invoice)
                    logger.info(f"Invoice: {invoice.id}, status: {invoice.status}")
                    
                    # For incomplete subscriptions, we need the payment intent
                    if invoice.payment_intent:
                        payment_intent = stripe.PaymentIntent.retrieve(invoice.payment_intent)
                        logger.info(f"Payment intent: {payment_intent.id}, status: {payment_intent.status}")
                        
                        if payment_intent.status == 'requires_action' or payment_intent.status == 'requires_confirmation':
                            requires_action = True
                            payment_intent_client_secret = payment_intent.client_secret
                except stripe.error.StripeError as e:
                    logger.warning(f"Could not retrieve invoice details: {str(e)}")
            
            if requires_action and payment_intent_client_secret:
                logger.info("Additional authentication required")
                return SubscriptionResponse(
                    subscribed=False,
                    date_subscribed=None,
                    date_subscription_expires=None,
                    requires_action=True,
                    payment_intent_client_secret=payment_intent_client_secret
                )
            
            # When the subscription is incomplete but no requires_action was found
            if subscription.status == 'incomplete' and payment_intent and payment_intent.status != 'succeeded':
                # Tell the front-end the subscription needs confirmation
                logger.info("Subscription requires confirmation")
                return SubscriptionResponse(
                    subscribed=False,
                    date_subscribed=None,
                    date_subscription_expires=None,
                    requires_action=True,
                    payment_intent_client_secret=payment_intent.client_secret if payment_intent else None
                )

            # Set subscription dates with proper error handling
            now = datetime.utcnow()
            
            # Handle current_period_end safely
            try:
                if hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                    logger.info(f"Current period end: {subscription.current_period_end}")
                    expires = datetime.utcfromtimestamp(subscription.current_period_end)
                else:
                    # Fallback - use 30 days from now
                    logger.warning("No current_period_end found, using 30-day default")
                    expires = now + timedelta(days=30)
            except Exception as period_error:
                logger.error(f"Error processing current_period_end: {str(period_error)}")
                # Fallback - use 30 days from now
                expires = now + timedelta(days=30)

            # Update user record
            is_active = subscription.status == 'active'
            user.subscribed = is_active
            user.date_subscribed = now if is_active else None
            user.date_subscription_expires = expires if is_active else None
            user.activated = True
            db.commit()

            logger.info(f"Subscription status for {user.email}: {subscription.status}")
            if is_active:
                logger.info(f"Subscription activated until {expires}")

            return SubscriptionResponse(
                subscribed=is_active,
                date_subscribed=now if is_active else None,
                date_subscription_expires=expires if is_active else None,
                requires_action=False,
                payment_intent_client_secret=None
            )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription error: {str(e)}")
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

@router.post("/webhook")
async def handle_stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    try:
        event = stripe.Webhook.construct_event(
            payload=await request.body(),
            sig_header=request.headers.get('stripe-signature'),
            secret=STRIPE_WEBHOOK_SECRET
        )
        
        logger.info(f"Processing webhook event: {event.type}")

        if event.type == 'customer.subscription.updated':
            subscription = event.data.object
            user = db.query(User).filter_by(
                stripe_customer_id=subscription.customer
            ).first()
            
            if user:
                user.subscribed = subscription.status == 'active'
                # Safely handle current_period_end here too
                try:
                    if hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                        user.date_subscription_expires = datetime.utcfromtimestamp(
                            subscription.current_period_end
                        )
                    else:
                        # No expiration date available, use 30 days from now
                        user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
                except Exception as e:
                    logger.error(f"Error handling current_period_end in webhook: {str(e)}")
                    user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
                
                db.commit()
                logger.info(f"Updated subscription status for {user.email}")
        
        # Handle payment_intent.succeeded for updating subscriptions
        elif event.type == 'payment_intent.succeeded':
            payment_intent = event.data.object
            logger.info(f"Payment intent succeeded: {payment_intent.id}")
            
            # Update any subscriptions associated with this payment
            if 'invoice' in payment_intent.metadata:
                invoice_id = payment_intent.metadata.invoice
                try:
                    invoice = stripe.Invoice.retrieve(invoice_id)
                    if invoice.subscription:
                        subscription = stripe.Subscription.retrieve(invoice.subscription)
                        if subscription.status == 'active':
                            user = db.query(User).filter_by(
                                stripe_customer_id=subscription.customer
                            ).first()
                            if user:
                                user.subscribed = True
                                user.date_subscribed = datetime.utcnow()
                                # Set expiration safely
                                if hasattr(subscription, 'current_period_end') and subscription.current_period_end:
                                    user.date_subscription_expires = datetime.utcfromtimestamp(
                                        subscription.current_period_end
                                    )
                                else:
                                    user.date_subscription_expires = datetime.utcnow() + timedelta(days=30)
                                db.commit()
                                logger.info(f"Updated subscription via payment success for {user.email}")
                except Exception as e:
                    logger.error(f"Error processing payment success webhook: {str(e)}")

        return {"status": "success"}

    except Exception as e:
        logger.error(f"Webhook error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
