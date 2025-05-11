@router.post("/", response_model=SubscriptionResponse)
async def create_subscription(
    payload: SubscriptionRequest,
    db: Session = Depends(get_db)
):
    """Create a new subscription"""
    try:
        # Log incoming request
        logger.info(f"Subscription request: {payload}")

        # Find user
        user = db.query(User).filter(User.email == payload.email).first()
        if not user:
            logger.error(f"User not found: {payload.email}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )

        logger.info(f"Processing subscription for {user.email}")

        # Create/get customer with error handling
        try:
            if not user.stripe_customer_id:
                logger.info("Creating new Stripe customer")
                customer = stripe.Customer.create(
                    email=user.email,
                    name=user.full_name,
                )
                user.stripe_customer_id = customer.id
                db.commit()
                logger.info(f"Created customer: {customer.id}")
            else:
                logger.info(f"Using existing customer: {user.stripe_customer_id}")
                customer = stripe.Customer.retrieve(user.stripe_customer_id)

        except stripe.error.StripeError as e:
            logger.error(f"Stripe customer error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Customer error: {str(e)}"
            )
        except Exception as e:
            logger.error(f"Database error creating customer: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to create customer record"
            )

        # Attach payment method with validation
        try:
            logger.info(f"Attaching payment method: {payload.paymentMethodId}")
            
            # Validate payment method exists
            payment_method = stripe.PaymentMethod.retrieve(payload.paymentMethodId)
            if not payment_method:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid payment method"
                )
            
            # Attach to customer
            payment_method = stripe.PaymentMethod.attach(
                payment_method.id,
                customer=customer.id,
            )
            
            # Set as default
            stripe.Customer.modify(
                customer.id,
                invoice_settings={
                    "default_payment_method": payment_method.id
                },
            )
            logger.info("Payment method attached successfully")

        except stripe.error.StripeError as e:
            logger.error(f"Payment method error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment error: {str(e)}"
            )

        # Create subscription with proper error handling
        try:
            logger.info(f"Creating subscription with price: {payload.planId}")
            
            # Validate price exists
            price = stripe.Price.retrieve(payload.planId)
            if not price:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Invalid price ID"
                )

            subscription = stripe.Subscription.create(
                customer=customer.id,
                items=[{"price": payload.planId}],
                payment_behavior='default_incomplete',
                payment_settings={'save_default_payment_method': 'on_subscription'},
                expand=['latest_invoice']
            )
            logger.info(f"Created subscription: {subscription.id}")

            # Get proper dates
            now = datetime.utcnow()
            try:
                expires = datetime.utcfromtimestamp(subscription.current_period_end)
            except (AttributeError, TypeError):
                logger.warning("Using default expiration")
                expires = now + timedelta(days=30)

            # Update user record
            user.subscribed = True
            user.date_subscribed = now
            user.date_subscription_expires = expires
            db.commit()
            logger.info("Updated user subscription status")

            return SubscriptionResponse(
                subscribed=True,
                date_subscribed=now,
                date_subscription_expires=expires,
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
            logger.error(f"Database error updating subscription: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to update subscription status"
            )

    except Exception as e:
        logger.error(f"Unexpected error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )
