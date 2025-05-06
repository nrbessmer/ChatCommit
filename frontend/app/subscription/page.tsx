'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  fetchSubscription,
  createSubscription,
  fetchUserProfile,
} from '@/lib/api'

export default function SubscriptionPage() {
  const router = useRouter()

  const [planId, setPlanId] = useState('basic-monthly')
  const [paymentMethodId, setPaymentMethodId] = useState('') // stub for PM
  const [status, setStatus] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [sub, setSub] = useState<null | {
    date_subscribed: string
    date_subscription_expires: string
  }>(null)

  useEffect(() => {
    // on mount, check existing subscription
    fetchSubscription()
      .then((data) => setSub(data))
      .catch(() => {})
  }, [])

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)
    setLoading(true)

    try {
      const result = await createSubscription({ planId, paymentMethodId })
      setSub({
        date_subscribed: result.date_subscribed,
        date_subscription_expires: result.date_subscription_expires,
      })
      setStatus('Subscribed successfully!')
      // refresh profile
      await fetchUserProfile()
    } catch (err: any) {
      setStatus(err.response?.data?.detail || 'Subscription failed')
    } finally {
      setLoading(false)
    }
  }

  // if already subscribed, show details
  if (sub) {
    return (
      <div className="max-w-md mx-auto p-6 bg-gray-900 text-gray-100 rounded">
        <h1 className="text-2xl mb-4">Your Subscription</h1>
        <p>Started: {new Date(sub.date_subscribed).toLocaleDateString()}</p>
        <p>Expires: {new Date(sub.date_subscription_expires).toLocaleDateString()}</p>
        <button
          className="mt-4 bg-green-600 py-2 rounded"
          onClick={() => router.push('/')}
        >
          Go to Dashboard
        </button>
      </div>
    )
  }

  // otherwise show subscribe form
  return (
    <div className="max-w-md mx-auto p-6 bg-gray-900 text-gray-100 rounded">
      <h1 className="text-2xl mb-4">Subscribe</h1>

      <form onSubmit={handleSubscribe} className="space-y-4">
        <div>
          <label>Plan</label>
          <select
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="w-full bg-gray-800 p-2 rounded"
          >
            <option value="basic-monthly">Basic Monthly</option>
            <option value="pro-annual">Pro Annual</option>
          </select>
        </div>

        <div>
          <label>Payment Method ID</label>
          <input
            type="text"
            required
            placeholder="pm_… from Stripe.js"
            value={paymentMethodId}
            onChange={(e) => setPaymentMethodId(e.target.value)}
            className="w-full bg-gray-800 p-2 rounded"
          />
        </div>

        {status && <p className="text-yellow-400">{status}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 py-2 rounded"
        >
          {loading ? 'Processing…' : 'Subscribe'}
        </button>
      </form>
    </div>
  )
}

