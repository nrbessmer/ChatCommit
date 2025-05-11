// app/subscription/page.tsx

const handleSubscribe = async () => {
  if (!stripe || !elements) return;
  setLoading(true);
  setMessage('');

  try {
    const card = elements.getElement(CardNumberElement);
    if (!card) {
      throw new Error('Card element not found');
    }

    // Create payment method
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
      billing_details: {
        email: localStorage.getItem('user_email'),
      },
    });

    if (error || !paymentMethod) {
      throw new Error(error?.message ?? 'Failed to create payment method');
    }

    // Create subscription
    const response = await createSubscription({
      paymentMethodId: paymentMethod.id,
      planId: priceId,
    });

    setMessage(
      `✅ Subscribed until ${new Date(
        response.date_subscription_expires
      ).toLocaleDateString()}`
    );

    // Redirect after successful subscription
    setTimeout(() => {
      router.push('/dashboard');
    }, 2000);

  } catch (e: any) {
    setMessage('❌ ' + (e.response?.data?.detail || e.message || 'Subscription failed'));
    
    // Handle 401 unauthorized
    if (e.response?.status === 401) {
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    }
  } finally {
    setLoading(false);
  }
};