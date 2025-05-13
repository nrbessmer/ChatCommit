'use client'

import React from 'react'

export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 bg-white text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
      <p><strong>Last updated:</strong> May 13, 2025</p>

      <h2 className="mt-6 text-2xl font-semibold">1. Data We Collect</h2>
      <ul className="list-disc pl-6">
        <li><strong>User Account Data:</strong> When you register, we store your name, email, address, and company in our backend database.</li>
        <li><strong>Chat History:</strong> All ChatGPT session data you commit via ChatCommit is sent to our backend and stored for retrieval and timeline views.</li>
        <li><strong>Payment Data:</strong> Stripe handles payment information. We only store non‑sensitive metadata (subscription status, dates) in our database.</li>
      </ul>

      <h2 className="mt-6 text-2xl font-semibold">2. How We Use Your Data</h2>
      <p>
        We use your account data to authenticate and personalize your experience. Chat history commits are stored so you can view, branch, and merge your sessions. Subscription metadata powers access control.
      </p>

      <h2 className="mt-6 text-2xl font-semibold">3. Data Sharing & Disclosure</h2>
      <p>
        We do <strong>not</strong> share your personal data or chat content with third parties, except:
      </p>
      <ul className="list-disc pl-6">
        <li>Stripe, for payment processing.</li>
        <li>Our hosting provider (Fly.io/Vercel) for app and data storage.</li>
      </ul>

      <h2 className="mt-6 text-2xl font-semibold">4. Security Measures</h2>
      <p>
        All data is transmitted over HTTPS. User passwords are hashed using industry‑standard algorithms. We implement database encryption at rest and regular audits.
      </p>

      <h2 className="mt-6 text-2xl font-semibold">5. Your Choices</h2>
      <ul className="list-disc pl-6">
        <li>You can delete your account at any time; this will remove all associated data from our database.</li>
        <li>You may export your chat commits via the extension UI before deleting your account.</li>
      </ul>

      <h2 className="mt-6 text-2xl font-semibold">6. Contact Us</h2>
      <p>
        For questions or requests regarding your data, email us at{' '}
        <a href="mailto:info@tullyedmvibe.com" className="text-blue-600 hover:underline">
          info@tullyedmvibe.com
        </a>.
      </p>
    </div>
  )
}