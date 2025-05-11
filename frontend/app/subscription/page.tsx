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

// ... (keep other interfaces)

function SubscriptionForm({ priceId }: SubscriptionFormProps): React.ReactElement {
  // ... (keep state and handlers)

  return (
    <div className="max-w-md mx-auto bg-gray-900 text-white p-6 mt-20 rounded-lg shadow">
      <h2 className="text-xl mb-4 text-green-400 font-bold">Subscribe</h2>

      <div className="space-y-4 mb-4">
        <div className="p-3 rounded border border-yellow-500 bg-yellow-100 text-black">
          <label className="block mb-1 text-gray-700">Card number</label>
          <CardNumberElement
            options={{
              style: { base: { fontSize: '16px' } },
              // Remove linkAuthentication
            }}
          />
        </div>

        <div className="p-3 rounded border border-yellow-500 bg-yellow-100 text-black flex gap-4">
          <div className="flex-1">
            <label className="block mb-1 text-gray-700">Expiry</label>
            <CardExpiryElement
              options={{
                style: { base: { fontSize: '16px' } }
              }}
            />
          </div>
          <div className="flex-1">
            <label className="block mb-1 text-gray-700">CVC</label>
            <CardCvcElement
              options={{
                style: { base: { fontSize: '16px' } }
              }}
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

// ... (keep SubscriptionPage component unchanged)

export default function SubscriptionPage(): React.ReactElement {
  // ... (keep implementation unchanged)
}