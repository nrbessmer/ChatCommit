// app/subscription/page.tsx

const handleSubscribe = async () => {
  if (!stripe || !elements) return;
  setLoading(true);

  try {
    const card = elements.getElement(CardNumberElement);
    if (!card) {
      setMessage('❌ Card element not found');
      return;
    }

    // Create payment method
    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
      billing_details: {
        email: localStorage.getItem('user_email'), // Make sure to store this on login
      },
    });

    if (error || !paymentMethod) {
      setMessage('❌ Payment error: ' + (error?.message ?? 'unknown'));
      return;
    }

    // Create subscription
    const response = await api.post('/subscription/create', {
      paymentMethodId: paymentMethod.id,
      planId: priceId,
      email: localStorage.getItem('user_email'),
    });

    // Store new access token
    if (response.data.access_token) {
      localStorage.setItem('auth_token', response.data.access_token);
    }

    setMessage(
      `✅ Subscribed until ${new Date(
        response.data.date_subscription_expires
      ).toLocaleDateString()}`
    );

    // Redirect or update UI as needed
    router.push('/dashboard');

  } catch (e: any) {
    setMessage(
      '❌ ' + (e.response?.data?.detail || e.message || 'Subscription failed')
    );
  } finally {
    setLoading(false);
  }
};