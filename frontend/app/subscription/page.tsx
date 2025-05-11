'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import {
  Elements,
  CardNumberElement,
  CardExpiryElement,
  CardCvcElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { api, createSubscription, getStripeConfig } from '@/lib/api'

interface SubscriptionFormProps {
  priceId: string
}

function SubscriptionForm({ priceId }: SubscriptionFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')
  const router = useRouter()

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

      // Create payment method
      setMessage('Processing payment...')
      const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
        billing_details: {
          email,
        },
      })

      if (pmError || !paymentMethod) {
        throw new Error(pmError?.message ?? 'Failed to create payment method')
      }

      // Create subscription using our typed API call
      setMessage('Setting up subscription...')
      const subscription = await createSubscription({
        email,
        paymentMethodId: paymentMethod.id,
        planId: priceId
      })

      // Handle response
      if (subscription.requires_action && subscription.payment_intent_client_secret) {
        setMessage('Additional authentication required...')
        const { error } = await stripe.confirmCardPayment(
          subscription.payment_intent_client_secret
        )
        if (error) {
          throw new Error(error.message)
        }
      }

      if (subscription.subscribed) {
        const expiryDate = new Date(subscription.date_subscription_expires!).toLocaleDateString()
        setMessage(`✅ Subscribed successfully! Valid until ${expiryDate}`)
        setTimeout(() => router.push('/dashboard'), 2000)
      } else {
        setMessage('❌ Subscription not activated. Please try again.')
      }

    } catch (e: any) {
      console.error('Subscription error:', e)
      setMessage(
        '❌ ' + (e.response?.data?.detail || e.message || 'Subscription failed')
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-gray-900 text-white p-6 mt-20 rounded-lg shadow">
      <h2 className="text-xl mb-4 text-green-400 font-bold">Subscribe</h2>

      <div className="space-y-4 mb-4">
        <div className="p-3 rounded border border-yellow-500 bg-yellow-100 text-black">
          <label className="block mb-1 text-gray-700">Card number</label>
          <CardNumberElement
            options={{
              style: { base: { fontSize: '16px' } }
            }}
          />
        </div>

        <div className="p-3 rounded border border-yellow-500 bg-yellow-100 text-black flex gap-4">
          <div className="flex-1">
            <label className="block mb-1 text-gray-700">Expiry</label>
            <CardExpiryElement
              options={{ style: { base: { fontSize: '16px' } } }}
            />
          </div>
          <div className="flex-1">
            <label className="block mb-1 text-gray-700">CVC</label>
            <CardCvcElement
              options={{ style: { base: { fontSize: '16px' } } }}
            />
          </div>
        </div>
      </div>

      <button
        disabled={loading || !stripe}
        onClick={handleSubscribe}
        className="w-full py-2 bg-green-500 hover:bg-green-600 rounded disabled:opacity-50 font-semibold"
      >
        {loading ? 'Processing…' : 'Subscribe'}
      </button>

      {message && (
        <div 
          className={`mt-4 p-3 rounded text-sm ${
            message.startsWith('✅')
              ? 'bg-green-100 text-green-800'
              : message.startsWith('❌')
              ? 'bg-red-100 text-red-800'
              : 'bg-blue-100 text-blue-800'
          }`}
        >
          {message}
        </div>
      )}

      <footer className="mt-8 text-center text-sm text-gray-500">
        <p>© 2025 Tully EDM Vibe</p>
        <p>info@tullyedmvibe.com</p>
      </footer>
    </div>
  )
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [priceId, setPriceId] = useState<string>('')
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const email = localStorage.getItem('user_email')
    if (!email) {
      router.push('/login')
      return
    }

    // Load Stripe configuration using our typed API call
    getStripeConfig()
      .then((config) => {
        setPriceId(config.priceId)
        setStripePromise(loadStripe(config.publishableKey))
      })
      .catch((error) => {
        console.error('Failed to load Stripe config:', error)
        setError('Failed to load payment configuration')
      })
      .finally(() => setChecking(false))
  }, [router])

  if (checking) {
    return <div className="mt-20 text-center">Loading…</div>
  }

  if (error) {
    return (
      <div className="mt-20 text-center text-red-600">
        {error}
      </div>
    )
  }

  if (!stripePromise) {
    return <div className="mt-20 text-center">Loading payment form…</div>
  }

  return (
    <Elements stripe={stripePromise}>
      <SubscriptionForm priceId={priceId} />
    </Elements>
  )
}