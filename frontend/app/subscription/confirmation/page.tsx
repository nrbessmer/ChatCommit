import React from 'react'

export default function ConfirmationPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-6">
      <div className="max-w-lg text-center bg-gray-800 p-8 rounded-lg shadow">
        <h1 className="text-2xl font-bold mb-4 text-green-400">Thank You for Your Purchase</h1>
        <p className="mb-6">
          Thank you for your purchase. You can reach us at{' '}
          <a href="mailto:info@tullyedmvibe.com" className="text-yellow-300 hover:underline">
            info@tullyedmvibe.com
          </a>.
        </p>
        <ul className="list-disc list-inside space-y-2 text-left">
          <li>
            Documentation: {' '}
            <a
              href="/CommitChat.pdf"
              download
              className="text-blue-400 hover:underline"
            >
              Download CommitChat.pdf
            </a>
          </li>
          <li>
            Extension:
            {' '}
            <a
              href="/extension.crx"
              download
              className="text-blue-400 hover:underline"
            >
              Download extension.crx
            </a>
          </li>
        </ul>
      </div>
    </div>
  )
}
