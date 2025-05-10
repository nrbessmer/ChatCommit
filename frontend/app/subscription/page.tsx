// app/subscription/page.tsx
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
import { api, fetchSubscription, createSubscription } from '@/lib/api'

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

    const card = elements.getElement(CardNumberElement)
    if (!card) {
      setMessage('❌ Card element not found')
      setLoading(false)
      return
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
    })

    if (error || !paymentMethod) {
      setMessage('❌ Payment error: ' + (error?.message ?? 'unknown'))
      setLoading(false)
      return
    }

    try {
      const res = await createSubscription({
        paymentMethodId: paymentMethod.id,
        planId: priceId,
      })
      setMessage(
        `✅ Subscribed until ${new Date(
          res.date_subscription_expires
        ).toLocaleDateString()}`
      )
    } catch (e: any) {
      setMessage(
        '❌ ' +
          (e.response?.data?.detail || e.message || 'Subscription failed')
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
          <CardNumberElement options={{ style: { base: { fontSize: '16px' } } }} />
        </div>

        <div className="p-3 rounded border border-yellow-500 bg-yellow-100 text-black flex gap-4">
          <div className="flex-1">
            <label className="block mb-1 text-gray-700">Expiry</label>
            <CardExpiryElement options={{ style: { base: { fontSize: '16px' } } }} />
          </div>
          <div className="flex-1">
            <label className="block mb-1 text-gray-700">CVC</label>
            <CardCvcElement options={{ style: { base: { fontSize: '16px' } } }} />
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
    // 1) Redirect if not logged in
    const token = typeof window !== 'undefined'
      ? localStorage.getItem('auth_token')
      : null
    if (!token) {
      router.push('/login')
      return
    }

    // 2) Check existing subscription
    fetchSubscription()
      .then(() => setAlready(true))
      .catch(() => {
        // 404 means no active subscription
      })
      .finally(() => {
        // 3) Load Stripe config
        api
          .get<StripeConfig>('/stripe/config')
          .then(res => {
            setPriceId(res.data.priceId)
            setStripePromise(loadStripe(res.data.publishableKey))
          })
          .catch(err => console.error('Failed to load Stripe config:', err))
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
