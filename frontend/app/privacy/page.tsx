// frontend/app/privacy/page.tsx
'use client'

import React from 'react'

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto p-8 bg-white text-gray-900">
      <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>

      <p>
        <strong>Last updated:</strong> May 13, 2025
      </p>

      <p>
        ChatCommit is a Chrome extension that helps you version‑control your ChatGPT
        conversations. We do not collect, transmit, or store any personal data on our
        servers. All data stays within your browser’s local storage.
      </p>

      <h2 className="mt-6 text-2xl font-semibold">Permissions</h2>
      <ul className="list-disc pl-6">
        <li>
          <strong>activeTab:</strong> Used only when you click “Commit” to read your current
          ChatGPT session.
        </li>
        <li>
          <strong>declarativeNetRequest:</strong> To intercept only chat.openai.com traffic
          and package it as a commit.
        </li>
        <li>
          <strong>scripting:</strong> To inject our small UI script into the ChatGPT page.
        </li>
        <li>
          <strong>storage:</strong> To save commit metadata and your preferences locally.
        </li>
      </ul>

      <h2 className="mt-6 text-2xl font-semibold">Data Handling</h2>
      <p>
        We never transmit your chat contents or metadata to any external servers. All commit
        data is stored in your browser. No analytics or telemetry is collected.
      </p>

      <h2 className="mt-6 text-2xl font-semibold">Contact Us</h2>
      <p>
        If you have any questions or concerns, please email us at{' '}
        <a href="mailto:info@tullyedmvibe.com" className="text-blue-600 hover:underline">
          info@tullyedmvibe.com
        </a>.
      </p>
    </div>
  )
}

