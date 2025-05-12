
# app/routers/subscription.py

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

# ─── Logger Setup ───────────────────────────────────────────
logger = logging.getLogger("subscription")
logger.setLevel(logging.INFO)
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(
        logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
    )
    logger.addHandler(handler)

# ─── Stripe Configuration ────────────────────────────────────
STRIPE_SECRET_KEY     = os.getenv("STRIPE_SECRET_KEY", "").strip()
STRIPE_PRICE_ID       = os.getenv("STRIPE_PRICE_ID", "").strip()
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "").strip()

if not STRIPE_SECRET_KEY:
    raise RuntimeError("STRIPE_SECRET_KEY is required")
if not STRIPE_PRICE_ID:
    raise RuntimeError("STRIPE_PRICE_ID is required")
if not STRIPE_WEBHOOK_SECRET:
    raise RuntimeError("STRIPE_WEBHOOK_SECRET is required")

stripe.api_key = STRIPE_SECRET_KEY
logger.info(f"Configured Stripe with key prefix {STRIPE_SECRET_KEY[:8]}…")

# ─── Pydantic Models ─────────────────────────────────────────
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

# ─── Router Setup ────────────────────────────────────────────
router = APIRouter(tags=["subscription"])

@router.get("/", response_model=SubscriptionResponse)
async def get_subscription_status(
    current_user: User = Depends(get_current_user),
    db: Session     = Depends(get_db),
):
    """Return subscription status or provide SCA client_secret if action needed."""
    try:
        logger.info(f"GET /subscription for {current_user.email}")
        if not current_user.subscribed and current_user.stripe_customer_id:
            subs = stripe.Subscription.list(
                customer=current_user.stripe_customer_id,
                status="incomplete",
                limit=1
            )
            if subs.data:
                sub = subs.data[0]
                inv_id = sub.latest_invoice if isinstance(sub.latest_invoice, str) else getattr(sub.latest_invoice, 'id', None)
                if inv_id:
                    inv = stripe.Invoice.retrieve(inv_id, expand=["payment_intent"])
                    pi = inv.payment_intent
                    if pi and pi.status in ('requires_action','requires_confirmation'):
                        return SubscriptionResponse(
                            subscribed=False,
                            date_subscribed=None,
                            date_subscription_expires=None,
                            requires_action=True,
                            payment_intent_client_secret=pi.client_secret
                        )
                # incomplete without actionable PI
                return SubscriptionResponse(
                    subscribed=False,
                    date_subscribed=None,
                    date_subscription_expires=None,
                    requires_action=True
                )
        # default: return DB state
        return SubscriptionResponse(
            subscribed=current_user.subscribed,
            date_subscribed=current_user.date_subscribed,
            date_subscription_expires=current_user.date_subscription_expires,
            requires_action=False
        )
    except Exception as e:
        logger.error(f"Error in get_subscription_status: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to fetch subscription status"
        )

@router.post("/", response_model=SubscriptionResponse)
async def create_subscription(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create subscription, confirm payment intent server-side, and return status."""
    if payload.email != current_user.email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Email mismatch")
    try:
        logger.info(f"POST /subscription for {current_user.email}")
        # 1) Ensure Stripe customer
        if not current_user.stripe_customer_id:
            cust = stripe.Customer.create(
                email=current_user.email,
                name=current_user.full_name
            )
            current_user.stripe_customer_id = cust.id
            db.commit()
        else:
            cust = stripe.Customer.retrieve(current_user.stripe_customer_id)
        # 2) Attach PaymentMethod and set as default
        stripe.PaymentMethod.attach(payload.paymentMethodId, customer=cust.id)
        stripe.Customer.modify(
            cust.id,
            invoice_settings={"default_payment_method": payload.paymentMethodId}
        )
        # 3) Create subscription allowing incomplete
        sub = stripe.Subscription.create(
            customer=cust.id,
            items=[{"price": payload.planId}],
            payment_behavior='allow_incomplete',
            payment_settings={'save_default_payment_method': 'on_subscription'},
            metadata={'user_id': str(current_user.id)}
        )
        logger.info(f"Subscription created: {sub.id}, status={sub.status}")
        # 4) If incomplete, retrieve invoice and PI
        if sub.status == 'incomplete':
            inv_id = sub.latest_invoice if isinstance(sub.latest_invoice, str) else getattr(sub.latest_invoice, 'id', None)
            if inv_id:
                inv = stripe.Invoice.retrieve(inv_id, expand=["payment_intent"])
                pi = inv.payment_intent
                if pi and pi.status in ('requires_action','requires_confirmation'):
                    # Confirm server-side
                    pi = stripe.PaymentIntent.confirm(pi.id)
                    logger.info(f"Confirmed PI {pi.id}, status={pi.status}")
            # Refresh subscription
            sub = stripe.Subscription.retrieve(sub.id)
        # 5) If active, update DB
        if sub.status == 'active':
            now = datetime.utcnow()
            expires_ts = getattr(sub, 'current_period_end', None)
            expires = datetime.utcfromtimestamp(expires_ts) if expires_ts else now + timedelta(days=30)
            current_user.subscribed = True
            current_user.date_subscribed = now
            current_user.date_subscription_expires = expires
            current_user.activated = True
            db.commit()
            return SubscriptionResponse(
                subscribed=True,
                date_subscribed=now,
                date_subscription_expires=expires,
                requires_action=False
            )
        # fallback: requires action
        return SubscriptionResponse(
            subscribed=False,
            date_subscribed=None,
            date_subscription_expires=None,
            requires_action=True
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error create_subscription: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error create_subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription"
        )

@router.post("/confirm", response_model=SubscriptionResponse)
async def confirm_subscription(
    payload: ConfirmSubscriptionRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Confirm PaymentIntent after client-side action."""
    try:
        pi = stripe.PaymentIntent.retrieve(
            payload.payment_intent_id,
            expand=['invoice.subscription']
        )
        sub_obj = getattr(pi.invoice, 'subscription', None)
        if pi.status == 'succeeded' and sub_obj and sub_obj.status == 'active':
            now = datetime.utcnow()
            expires_ts = getattr(sub_obj, 'current_period_end', None)
            expires = datetime.utcfromtimestamp(expires_ts) if expires_ts else now + timedelta(days=30)
            current_user.subscribed = True
            current_user.date_subscribed = now
            current_user.date_subscription_expires = expires
            current_user.activated = True
            db.commit()
            return SubscriptionResponse(
                subscribed=True,
                date_subscribed=now,
                date_subscription_expires=expires,
                requires_action=False
            )
        if pi.status in ('requires_action','requires_confirmation','requires_payment_method'):
            return SubscriptionResponse(
                subscribed=False,
                date_subscribed=None,
                date_subscription_expires=None,
                requires_action=True,
                payment_intent_client_secret=pi.client_secret
            )
        db.refresh(current_user)
        return SubscriptionResponse(
            subscribed=current_user.subscribed,
            date_subscribed=current_user.date_subscribed,
            date_subscription_expires=current_user.date_subscription_expires,
            requires_action=False
        )
    except stripe.error.StripeError as e:
        logger.error(f"Stripe error confirm_subscription: {e}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.error(f"Error confirm_subscription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm subscription"
        )

@router.post("/webhook")
async def handle_stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Process Stripe webhook events to sync subscription status."""
    payload = await request.body()
    sig = request.headers.get('stripe-signature')
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        logger.error(f"Webhook error: {e}")
        raise HTTPException(status_code=400, detail="Invalid webhook payload or signature")
    obj = event.data.object
    user = None
    cust = getattr(obj, 'customer', None)
    meta = getattr(obj, 'metadata', {})
    if cust:
        user = db.query(User).filter(User.stripe_customer_id == cust).first()
    if not user and meta.get('user_id'):
        user = db.query(User).get(int(meta['user_id']))
    if not user and meta.get('user_email'):
        user = db.query(User).filter(User.email == meta['user_email']).first()
    if not user:
        logger.warning("Webhook: user not found")
        return {"status": "ignored"}
    try:
        if event.type.startswith('customer.subscription.'):
            sub = obj
            active = sub.status == 'active'
            user.subscribed = active
            if active:
                user.date_subscribed = datetime.utcfromtimestamp(getattr(sub, 'start_date', datetime.utcnow().timestamp()))
                user.date_subscription_expires = datetime.utcfromtimestamp(getattr(sub, 'current_period_end', (datetime.utcnow() + timedelta(days=30)).timestamp()))
                user.activated = True
            else:
                user.date_subscription_expires = datetime.utcfromtimestamp(getattr(sub, 'ended_at', datetime.utcnow().timestamp()))
            db.commit()
        elif event.type == 'invoice.payment_succeeded':
            inv = obj
            if inv.subscription:
                sub = stripe.Subscription.retrieve(inv.subscription)
                if sub.status == 'active':
                    user.subscribed = True
                    user.date_subscribed = datetime.utcfromtimestamp(sub.start_date)
                    user.date_subscription_expires = datetime.utcfromtimestamp(sub.current_period_end)
                    user.activated = True
                    db.commit()
        elif event.type == 'invoice.payment_failed':
            logger.warning(f"Payment failed for invoice {obj.id}")
    except Exception as e:
        logger.error(f"Webhook processing error: {e}")
    return {"status": "success"}

