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
if not STRIPE_WEBHOOK_SECRET:  # Make sure webhook secret is also checked
    raise RuntimeError("STRIPE_WEBHOOK_SECRET is required")

stripe.api_key = STRIPE_SECRET_KEY
logger.info(f"Configured Stripe with key starting: {STRIPE_SECRET_KEY[:7]}...")

# ─── Models ───────────────────────────────────────────────

class SubscriptionRequest(BaseModel):
    email: EmailStr
    paymentMethodId: str
    planId: str

class ConfirmSubscriptionRequest(BaseModel):
    payment_intent_id: str

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
                        invoice_id = sub.latest_invoice
                        if isinstance(invoice_id, str):  # Ensure it's an ID string
                            invoice = stripe.Invoice.retrieve(invoice_id, expand=['payment_intent'])
                            if hasattr(invoice, 'payment_intent') and invoice.payment_intent:
                                payment_intent_id = invoice.payment_intent
                                if isinstance(payment_intent_id, str):  # Ensure it's an ID string
                                    try:
                                        payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
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
                                        logger.error(f"Error retrieving payment intent: {str(e)}")
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
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)  # Ensure user is authenticated
):
    """Create a new subscription"""
    # Ensure the email in payload matches the authenticated user's email
    if payload.email != current_user.email:
        logger.error(f"Email mismatch: payload email {payload.email} != current user email {current_user.email}")
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email in request does not match authenticated user."
        )
    
    user = current_user  # Use the authenticated user

    try:
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
                logger.info(f"Created Stripe customer: {customer.id} for user {user.email}")
            else:
                customer = stripe.Customer.retrieve(user.stripe_customer_id)
                logger.info(f"Using existing customer: {customer.id} for user {user.email}")

        except stripe.error.StripeError as e:
            logger.error(f"Customer error for {user.email}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Customer error: {str(e)}"
            )

        # Attach payment method
        try:
            logger.info(f"Attaching payment method {payload.paymentMethodId} to customer {customer.id}")
            payment_method = stripe.PaymentMethod.attach(
                payload.paymentMethodId,
                customer=customer.id,
            )
            
            logger.info(f"Setting payment method {payment_method.id} as default for customer {customer.id}")
            stripe.Customer.modify(
                customer.id,
                invoice_settings={
                    "default_payment_method": payment_method.id
                },
            )

        except stripe.error.StripeError as e:
            logger.error(f"Payment method error for {user.email}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment error: {str(e)}"
            )

        # Create subscription
        try:
            logger.info(f"Creating subscription for customer {customer.id} with plan {payload.planId}")
            
            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": payload.planId}],
                payment_behavior='default_incomplete',
                payment_settings={'save_default_payment_method': 'on_subscription'},
                metadata={'user_id': str(user.id), 'user_email': user.email},  # Add email to metadata
                expand=['latest_invoice']  # Expand only latest_invoice, not payment_intent directly
            )
            
            logger.info(f"Created subscription: {subscription.id} for user {user.email}")
            logger.info(f"Subscription details: id={subscription.id}, status={subscription.status}")
            
            payment_intent_client_secret = None
            requires_action = False
            
            # Check if subscription is incomplete and has a latest invoice
            if subscription.status == 'incomplete' and subscription.latest_invoice:
                # Fetch the payment intent associated with the invoice, if it exists
                invoice = subscription.latest_invoice
                if isinstance(invoice, dict):
                    invoice = stripe.Invoice.retrieve(invoice['id'], expand=['payment_intent'])
                if hasattr(invoice, 'payment_intent') and invoice.payment_intent:
                    pi = invoice.payment_intent
                    if hasattr(pi, 'status') and pi.status in ['requires_action', 'requires_confirmation']:
                        requires_action = True
                        payment_intent_client_secret = pi.client_secret
                        logger.info(f"Subscription {subscription.id} for {user.email} requires action. PI status: {pi.status}")
                        return SubscriptionResponse(
                            subscribed=False,
                            date_subscribed=None,
                            date_subscription_expires=None,
                            requires_action=True,
                            payment_intent_client_secret=payment_intent_client_secret
                        )
                # If status is incomplete but no payment intent or not requiring action
                logger.info(f"Subscription {subscription.id} for {user.email} is incomplete but does not require immediate client action.")
                return SubscriptionResponse(
                    subscribed=False,
                    date_subscribed=None,
                    date_subscription_expires=None,
                    requires_action=False,
                    payment_intent_client_secret=None
                )

            # If subscription is active immediately (e.g., trial without payment)
            if subscription.status == 'active':
                now = datetime.utcnow()
                expires = datetime.utcfromtimestamp(subscription.current_period_end) if subscription.current_period_end else now + timedelta(days=30)
                
                user.subscribed = True
                user.date_subscribed = now
                user.date_subscription_expires = expires
                user.activated = True  # Assuming activated means has an active subscription
                db.commit()
                logger.info(f"Subscription {subscription.id} for {user.email} is active. Expires: {expires}")
                return SubscriptionResponse(
                    subscribed=True,
                    date_subscribed=now,
                    date_subscription_expires=expires,
                    requires_action=False,
                    payment_intent_client_secret=None
                )

            # Fallback for other statuses, or if logic above didn't catch a specific case
            logger.warning(f"Subscription {subscription.id} for {user.email} has status {subscription.status}, not handled by specific flows.")
            return SubscriptionResponse(
                subscribed=False,
                date_subscribed=None,
                date_subscription_expires=None,
                requires_action=False,  # Default to false, specific cases handled above
                payment_intent_client_secret=None
            )

        except stripe.error.StripeError as e:
            logger.error(f"Subscription creation error for {user.email}: {str(e)}")
            # Check if error is due to payment failure that needs action
            if hasattr(e, 'code') and e.code == 'card_error' and hasattr(e, 'payment_intent') and e.payment_intent and e.payment_intent.status == 'requires_action':
                return SubscriptionResponse(
                    subscribed=False,
                    date_subscribed=None,
                    date_subscription_expires=None,
                    requires_action=True,
                    payment_intent_client_secret=e.payment_intent.client_secret
                )
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Subscription error: {str(e)}"
            )

    except HTTPException:  # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        logger.error(f"Unexpected error during subscription creation for {user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}"
        )

@router.post("/confirm", response_model=SubscriptionResponse)
async def confirm_subscription(
    payload: ConfirmSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm a subscription after payment authentication has been completed by the client"""
    try:
        logger.info(f"Confirming subscription payment for user {current_user.email} with PI ID: {payload.payment_intent_id}")
        
        if not current_user.stripe_customer_id:
            logger.error(f"No Stripe customer ID for user {current_user.email} during confirmation.")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No Stripe customer found for this user."
            )
            
        # Retrieve the payment intent
        try:
            payment_intent = stripe.PaymentIntent.retrieve(
                payload.payment_intent_id,
                expand=['invoice.subscription']  # Expand to get subscription details
            )
            logger.info(f"Payment intent {payment_intent.id} status for user {current_user.email}: {payment_intent.status}")
            
            # Check if this payment is associated with an invoice and subscription
            if payment_intent.invoice and payment_intent.invoice.subscription:
                subscription = payment_intent.invoice.subscription
                
                # If the payment was successful and subscription is now active
                if payment_intent.status == 'succeeded' and subscription.status == 'active':
                    now = datetime.utcnow()
                    expires = datetime.utcfromtimestamp(subscription.current_period_end) if subscription.current_period_end else now + timedelta(days=30)
                        
                    current_user.subscribed = True
                    current_user.date_subscribed = now
                    current_user.date_subscription_expires = expires
                    current_user.activated = True
                    db.commit()
                    
                    logger.info(f"Subscription {subscription.id} confirmed and activated for {current_user.email} until {expires}.")
                    
                    return SubscriptionResponse(
                        subscribed=True,
                        date_subscribed=now,
                        date_subscription_expires=expires,
                        requires_action=False,
                        payment_intent_client_secret=None
                    )
                elif subscription.status == 'incomplete' or payment_intent.status == 'requires_payment_method' or payment_intent.status == 'requires_confirmation' or payment_intent.status == 'requires_action':
                    logger.warning(f"Subscription {subscription.id} for {current_user.email} still requires action or is incomplete after confirmation attempt. PI status: {payment_intent.status}, Sub status: {subscription.status}")
                    return SubscriptionResponse(
                        subscribed=False,
                        date_subscribed=None,
                        date_subscription_expires=None,
                        requires_action=True,
                        payment_intent_client_secret=payment_intent.client_secret
                    )
                else:  # Payment succeeded but subscription not active, or other states
                    logger.warning(f"Payment {payment_intent.id} status: {payment_intent.status}, Subscription {subscription.id} status: {subscription.status} for user {current_user.email}. Not activating.")
                    # Fall through to check generic user status
            
            # If payment succeeded but couldn't link to subscription directly through PI expand
            # This might happen if confirmation is called much later or PI isn't directly linked to a new sub in some flows
            if payment_intent.status == 'succeeded':
                logger.info(f"Payment intent {payment_intent.id} succeeded for {current_user.email}, but no direct subscription link found via PI expand. Checking user's subscriptions.")
                
                # Re-check user's current subscription status from DB
                # This relies on webhooks to have updated the status if PI succeeded and sub became active
                db.refresh(current_user)
                if current_user.subscribed:
                    logger.info(f"User {current_user.email} is already marked as subscribed in DB. Returning current status.")
                    return SubscriptionResponse(
                        subscribed=current_user.subscribed,
                        date_subscribed=current_user.date_subscribed,
                        date_subscription_expires=current_user.date_subscription_expires,
                        requires_action=False,
                        payment_intent_client_secret=None
                    )
                else:  # User not subscribed in DB, try to find an active subscription via Stripe API
                    active_subs = stripe.Subscription.list(customer=current_user.stripe_customer_id, status='active', limit=1)
                    if active_subs and active_subs.data:
                        active_sub = active_subs.data[0]
                        now = datetime.utcnow()
                        expires = datetime.utcfromtimestamp(active_sub.current_period_end) if active_sub.current_period_end else now + timedelta(days=30)
                        current_user.subscribed = True
                        current_user.date_subscribed = now
                        current_user.date_subscription_expires = expires
                        current_user.activated = True
                        db.commit()
                        logger.info(f"Found active Stripe subscription {active_sub.id} for {current_user.email} and updated DB. Expires: {expires}")
                        return SubscriptionResponse(
                            subscribed=True,
                            date_subscribed=now,
                            date_subscription_expires=expires,
                            requires_action=False,
                            payment_intent_client_secret=None
                        )

            logger.warning(f"Payment intent {payment_intent.id} for {current_user.email} confirmed, but no subscription could be definitively activated or found. PI status: {payment_intent.status}")
            # Return current status from DB if no action clearly results
            db.refresh(current_user)
            return SubscriptionResponse(
                subscribed=current_user.subscribed,
                date_subscribed=current_user.date_subscribed,
                date_subscription_expires=current_user.date_subscription_expires,
                requires_action=False,  # Default unless PI indicates otherwise
                payment_intent_client_secret=payment_intent.client_secret if payment_intent.status in ['requires_action', 'requires_confirmation', 'requires_payment_method'] else None
            )
            
        except stripe.error.StripeError as e:
            logger.error(f"Stripe error during confirmation for {current_user.email} with PI {payload.payment_intent_id}: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment confirmation error: {str(e)}"
            )
            
    except HTTPException:  # Re-raise HTTPExceptions directly
        raise
    except Exception as e:
        logger.error(f"Unexpected error in confirm_subscription for {current_user.email}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm subscription"
        )

@router.post("/webhook")
async def handle_stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Handle Stripe webhook events"""
    payload_body = await request.body()
    sig_header = request.headers.get('stripe-signature')
    event = None

    try:
        event = stripe.Webhook.construct_event(
            payload=payload_body, sig_header=sig_header, secret=STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        # Invalid payload
        logger.error(f"Webhook error: Invalid payload: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload")
    except stripe.error.SignatureVerificationError as e:
        # Invalid signature
        logger.error(f"Webhook error: Invalid signature: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature")
    except Exception as e:
        logger.error(f"Webhook error: General error during event construction: {e}")
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Webhook processing error")

    logger.info(f"Processing webhook event: id={event.id}, type={event.type}")
    
    # Find user associated with the event
    customer_id = None
    user_id_metadata = None
    user_email_metadata = None

    if hasattr(event.data.object, 'customer') and event.data.object.customer:
        customer_id = event.data.object.customer
    elif hasattr(event.data.object, 'id') and event.data.object.object == 'customer':  # e.g. customer.created
        customer_id = event.data.object.id
    
    if hasattr(event.data.object, 'metadata'):
        user_id_metadata = event.data.object.metadata.get('user_id')
        user_email_metadata = event.data.object.metadata.get('user_email')

    user = None
    if customer_id:
        user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
    
    if not user and user_id_metadata:  # Fallback to user_id from metadata if customer lookup failed
        try:
            user = db.query(User).filter(User.id == int(user_id_metadata)).first()
        except ValueError:
            logger.warning(f"Invalid user_id in metadata: {user_id_metadata} for event {event.id}")
    
    if not user and user_email_metadata:  # Fallback to email from metadata
        user = db.query(User).filter(User.email == user_email_metadata).first()

    if not user:
        logger.warning(f"Webhook event {event.id} ({event.type}): User not found for customer {customer_id} or metadata (user_id: {user_id_metadata}, email: {user_email_metadata}). Event will not be fully processed for user DB update.")
        # Still return 200 to Stripe, as the event itself is valid
        return {"status": "success, user not found"}

    try:
        if event.type == 'customer.subscription.updated' or \
           event.type == 'customer.subscription.created' or \
           event.type == 'customer.subscription.deleted':
            subscription = event.data.object
            is_active = subscription.status == 'active'
            
            user.subscribed = is_active
            if is_active:
                if not user.date_subscribed:  # Only set if not already set, or if it's a new subscription
                    user.date_subscribed = datetime.utcfromtimestamp(subscription.start_date) if subscription.start_date else datetime.utcnow()
                user.date_subscription_expires = datetime.utcfromtimestamp(subscription.current_period_end) if subscription.current_period_end else datetime.utcnow() + timedelta(days=30)
                user.activated = True
            elif subscription.status == 'canceled' or event.type == 'customer.subscription.deleted':
                # Keep date_subscribed, but clear expires or set to past if needed
                user.date_subscription_expires = datetime.utcfromtimestamp(subscription.ended_at) if hasattr(subscription, 'ended_at') and subscription.ended_at else datetime.utcnow()
                # user.activated might be set to False or based on other logic
            else:  # Other non-active statuses (incomplete, past_due, etc.)
                user.date_subscription_expires = datetime.utcfromtimestamp(subscription.current_period_end) if subscription.current_period_end else None

            db.commit()
            logger.info(f"Webhook: Updated subscription status for {user.email} to {subscription.status}. Active: {is_active}. Expires: {user.date_subscription_expires}")
        
        elif event.type == 'invoice.payment_succeeded':
            invoice = event.data.object
            if invoice.subscription:  # This invoice is for a subscription
                # Retrieve the subscription to ensure its status is up-to-date
                try:
                    subscription = stripe.Subscription.retrieve(invoice.subscription)
                    if subscription.status == 'active':
                        user.subscribed = True
                        if not user.date_subscribed or user.date_subscribed > datetime.utcfromtimestamp(subscription.start_date):  # If re-subscribing or first time
                            user.date_subscribed = datetime.utcfromtimestamp(subscription.start_date) if subscription.start_date else datetime.utcnow()
                        user.date_subscription_expires = datetime.utcfromtimestamp(subscription.current_period_end) if subscription.current_period_end else datetime.utcnow() + timedelta(days=30)
                        user.activated = True
                        db.commit()
                        logger.info(f"Webhook (invoice.payment_succeeded): Activated subscription for {user.email} via invoice {invoice.id}. Expires: {user.date_subscription_expires}")
                except stripe.error.StripeError as e:
                    logger.error(f"Webhook (invoice.payment_succeeded): Error retrieving subscription {invoice.subscription} for user {user.email}: {e}")
        
        elif event.type == 'invoice.payment_failed':
            invoice = event.data.object
            if invoice.subscription:
                # Optionally update user status here, e.g., mark as past_due if subscription status reflects that
                logger.warning(f"Webhook (invoice.payment_failed): Payment failed for invoice {invoice.id} (subscription {invoice.subscription}) for user {user.email}.")
                # The customer.subscription.updated event should handle the subscription status change (e.g., to past_due or canceled)

        # Add more event types as needed
        # elif event.type == 'another.event.type':
        #    pass

    except Exception as e:
        logger.error(f"Webhook processing error for event {event.id} ({event.type}) for user {user.email if user else 'Unknown'}: {str(e)}")
        # Do not raise HTTPException here to ensure Stripe gets a 200 unless it's a setup/auth issue.
        # Log the error and Stripe can retry if it's a transient issue on our side.
        # If it's a persistent data issue, manual intervention might be needed.
        return {"status": "error during processing, event logged"}

    return {"status": "success"}
