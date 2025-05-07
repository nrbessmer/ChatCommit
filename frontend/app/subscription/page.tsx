'use client'

import { useState } from 'react'
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
  const [plan, setPlan] = useState<'pro_annual' | 'pro_monthly'>('pro_annual')

  const handleSubscribe = async () => {
    setLoading(true)
    const cardElement = elements?.getElement(CardElement)

    if (!stripe || !cardElement) return

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    })

    if (error || !paymentMethod) {
      setMessage('❌ Payment error: ' + error.message)
      setLoading(false)
      return
    }

    try {
      const res = await createSubscription({
        paymentMethodId: paymentMethod.id,
        planId: plan,
      })
      setMessage(`✅ Subscribed until ${new Date(res.date_subscription_expires * 1000).toLocaleDateString()}`)
    } catch (err) {
      setMessage('❌ Subscription failed. Please try again.')
    }

    setLoading(false)
  }

  return (
    <div className="max-w-md mx-auto bg-gray-900 text-white p-6 mt-20 rounded-lg shadow">
      <h2 className="text-xl mb-4 text-green-400 font-bold">Subscribe</h2>
      <div className="flex items-center justify-between mb-4 text-sm text-white">
        <label className="flex items-center">
          <input
            type="radio"
            name="plan"
            value="pro_annual"
            checked={plan === 'pro_annual'}
            onChange={() => setPlan('pro_annual')}
            className="mr-2"
          />
          $70/year
        </label>
        <label className="flex items-center">
          <input
            type="radio"
            name="plan"
            value="pro_monthly"
            checked={plan === 'pro_monthly'}
            onChange={() => setPlan('pro_monthly')}
            className="mr-2"
          />
          $10/month
        </label>
      </div>

      <div className="p-3 rounded border border-yellow-500 bg-yellow-100 text-black mb-4">
        <CardElement />
      </div>

      <button
        disabled={loading}
        onClick={handleSubscribe}
        className="w-full py-2 bg-green-500 hover:bg-green-600 rounded disabled:opacity-50 font-semibold"
      >
        {loading
          ? 'Processing…'
          : plan === 'pro_annual'
          ? 'Subscribe to Annual ($70/year)'
          : 'Subscribe to Monthly ($10/month)'}
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
