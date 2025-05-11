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
import { api, createSubscription, fetchSubscription } from '@/lib/api'

interface StripeConfig {
  publishableKey: string
  priceId: string
}

function SubscriptionForm({ priceId }: { priceId: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string>('')

  const handleSubscribe = async () => {
    if (!stripe || !elements) return
    setLoading(true)
    setMessage('')

    try {
      const card = elements.getElement(CardNumberElement)
      if (!card) {
        throw new Error('Card element not found')
      }

      // Create payment method
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card,
      })

      if (error || !paymentMethod) {
        throw new Error(error?.message ?? 'Failed to create payment method')
      }

      // Create subscription
      const response = await createSubscription({
        paymentMethodId: paymentMethod.id,
        planId: priceId,
      })

      setMessage(
        `✅ Subscribed until ${new Date(
          response.date_subscription_expires
        ).toLocaleDateString()}`
      )

      // Optional: redirect to dashboard after successful subscription
      // setTimeout(() => router.push('/dashboard'), 2000)

    } catch (e: any) {
      console.error('Subscription error:', e)
      setMessage(
        '❌ ' + (e.response?.data?.detail || e.message || 'Subscription failed')
      )

      // If unauthorized, redirect to login
      if (e.response?.status === 401) {
        setTimeout(() => {
          window.location.href = '/login'
        }, 2000)
      }
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
        disabled={loading}
        onClick={handleSubscribe}
        className="w-full py-2 bg-green-500 hover:bg-green-600 rounded disabled:opacity-50 font-semibold"
      >
        {loading ? 'Processing…' : 'Subscribe'}
      </button>

      {message && (
        <p className="mt-4 text-sm text-yellow-300 whitespace-pre-wrap">{message}</p>
      )}
    </div>
  )
}

export default function SubscriptionPage() {
  const router = useRouter()
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [priceId, setPriceId] = useState<string>('')
  const [checking, setChecking] = useState(true)
  const [already, setAlready] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (!token) {
      router.push('/login')
      return
    }

    // First check subscription status
    fetchSubscription()
      .then(response => {
        if (response.subscribed) {
          setAlready(true)
        }
      })
      .catch(() => {
        // Not subscribed - continue loading Stripe
      })
      .finally(() => {
        // Then load Stripe configuration
        api.get<StripeConfig>('/stripe/config')
          .then(res => {
            setPriceId(res.data.priceId)
            setStripePromise(loadStripe(res.data.publishableKey))
          })
          .catch(console.error)
          .finally(() => setChecking(false))
      })
  }, [router])

  if (checking) {
    return <div className="mt-20 text-center">Loading…</div>
  }

  if (already) {
    return (
      <div className="mt-20 text-center text-green-600">
        You already have an active subscription.
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