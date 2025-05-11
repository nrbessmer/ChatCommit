const handleSubscribe = async () => {
  if (!stripe || !elements) return
  setLoading(true)
  setMessage('')

  try {
    const email = localStorage.getItem('user_email')
    if (!email) {
      throw new Error('User email not found')
    }

    const card = elements.getElement(CardNumberElement)
    if (!card) {
      throw new Error('Card element not found')
    }

    setMessage('Processing payment...')
    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
      billing_details: { email }
    })

    if (pmError) {
      throw new Error(pmError.message)
    }

    if (!paymentMethod) {
      throw new Error('Failed to create payment method')
    }

    setMessage('Setting up subscription...')
    const response = await createSubscription({
      email,
      paymentMethodId: paymentMethod.id,
      planId: priceId
    })

    if (response.requires_action && response.payment_intent_client_secret) {
      setMessage('Additional authentication required...')
      const { error } = await stripe.confirmCardPayment(
        response.payment_intent_client_secret
      )
      if (error) {
        throw new Error(error.message)
      }
    }

    if (response.subscribed) {
      setMessage(`✅ Subscription activated! Valid until ${new Date(response.date_subscription_expires!).toLocaleDateString()}`)
      setTimeout(() => router.push('/dashboard'), 2000)
    } else {
      setMessage('❌ Subscription not activated. Please try again.')
    }

  } catch (e: any) {
    console.error('Subscription error:', e)
    const errorMessage = e.response?.data?.detail || e.message || 'Subscription failed'
    setMessage(`❌ ${errorMessage}`)
  } finally {
    setLoading(false)
  }
}