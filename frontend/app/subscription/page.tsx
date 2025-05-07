'use client'

import { useEffect, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from '@stripe/react-stripe-js'
import { createSubscription } from '@/lib/api'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function SubscriptionForm() {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  const handleSubscribe = async () => {
    setLoading(true)
    const cardElement = elements?.getElement(CardElement)

    if (!stripe || !cardElement) return

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    })

    if (error || !paymentMethod) {
      setMessage('Payment error.')
      setLoading(false)
      return
    }

    try {
      const res = await createSubscription({
        paymentMethodId: paymentMethod.id,
        planId: 'pro_annual', // hardcoded plan ID
      })
      setMessage(`Subscribed until ${res.date_subscription_expires}`)
    } catch {
      setMessage('Subscription failed')
    }

    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto bg-gray-900 text-white p-6 mt-20 rounded-lg shadow">
      <h2 className="text-xl mb-4 text-green-400 font-bold">Subscribe</h2>
      <CardElement className="bg-gray-800 p-2 rounded mb-4" />
      <button
        disabled={loading}
        onClick={handleSubscribe}
        className="w-full py-2 bg-green-500 hover:bg-green-600 rounded disabled:opacity-50"
      >
        {loading ? 'Processing…' : 'Subscribe to Pro Annual'}
      </button>
      {message && <p className="mt-4 text-sm text-yellow-300">{message}</p>}
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <Elements stripe={stripePromise}>
      <SubscriptionForm />
    </Elements>
  )
}
