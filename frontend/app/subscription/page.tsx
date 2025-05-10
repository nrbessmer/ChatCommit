'use client'

import React, { useState, useEffect } from 'react'
import { loadStripe, Stripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import axios from 'axios'
import { createSubscription } from '@/lib/api'

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
    const card = elements.getElement(CardElement)
    if (!card) return

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card,
    })

    if (error || !paymentMethod) {
      setMessage('❌ Payment error: ' + error?.message)
      setLoading(false)
      return
    }

    try {
      const res = await createSubscription({
        paymentMethodId: paymentMethod.id,
        planId: priceId,
      })
      setMessage(`✅ Subscribed until ${new Date(res.date_subscription_expires).toLocaleDateString()}`)
    } catch (e: any) {
      setMessage('❌ ' + (e.response?.data?.detail || e.message || 'Subscription failed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto bg-gray-900 text-white p-6 mt-20 rounded-lg shadow">
      <h2 className="text-xl mb-4 text-green-400 font-bold">Subscribe</h2>
      <div className="p-3 rounded border border-yellow-500 bg-yellow-100 text-black mb-4">
        <CardElement />
      </div>
      <button
        disabled={loading}
        onClick={handleSubscribe}
        className="w-full py-2 bg-green-500 hover:bg-green-600 rounded disabled:opacity-50 font-semibold"
      >
        {loading ? 'Processing…' : 'Subscribe'}
      </button>
      {message && <p className="mt-4 text-sm text-yellow-300">{message}</p>}
    </div>
  )
}

export default function SubscriptionPage() {
  const [stripePromise, setStripePromise] = useState<Promise<Stripe | null> | null>(null)
  const [priceId, setPriceId] = useState<string>('')

  useEffect(() => {
    axios.get<StripeConfig>('/stripe/config').then(({ data }) => {
      setPriceId(data.priceId)
      setStripePromise(loadStripe(data.publishableKey))
    })
  }, [])

  if (!stripePromise) return <div>Loading payment form…</div>

  return (
    <Elements stripe={stripePromise}>
      <SubscriptionForm priceId={priceId} />
    </Elements>
  )
}
