// In subscription/page.tsx
const handleSubscribe = async () => {
  if (!stripe || !elements) return;
  setLoading(true);
  setMessage('');

  try {
    const email = localStorage.getItem('user_email');
    if (!email) {
      throw new Error('User email not found');
    }

    const card = elements.getElement(CardNumberElement);
    if (!card) {
      throw new Error('Card element not found');
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
    });

    if (error || !paymentMethod) {
      throw new Error(error?.message ?? 'Failed to create payment method');
    }

    // Create subscription without requiring auth
    const response = await api.post('/subscription/', {
      email,
      paymentMethodId: paymentMethod.id,
      planId: priceId,
    });

    setMessage(
      `✅ Subscribed until ${new Date(
        response.data.date_subscription_expires
      ).toLocaleDateString()}`
    );

    // Redirect to login after successful subscription
    setTimeout(() => {
      router.push('/login');
    }, 2000);

  } catch (e: any) {
    setMessage('❌ ' + (e.response?.data?.detail || e.message || 'Subscription failed'));
  } finally {
    setLoading(false);
  }
};