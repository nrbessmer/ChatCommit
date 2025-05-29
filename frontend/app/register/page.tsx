'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { registerUser, loginUser } from '@/lib/api'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // 1) Register the user (auto-active & subscribed on backend)
      await registerUser({
        full_name: fullName,
        address,
        email,
        company,
        password,
      })

      // 2) Immediately log them in to get a JWT
      const { access_token } = await loginUser({ email, password })
      localStorage.setItem('auth_token', access_token)

      // 3) Skip subscription flow (users are now auto-subscribed)
      // router.push('/subscription')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration or login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-gray-800 text-white rounded">
      <h1 className="text-2xl mb-4">Create your account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-red-400">{error}</p>}

        <div>
          <label>Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            required
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label>Address</label>
          <input
            type="text"
            value={address}
            onChange={e => setAddress(e.target.value)}
            required
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label>Email</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label>Company</label>
          <input
            type="text"
            value={company}
            onChange={e => setCompany(e.target.value)}
            required
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <div>
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            className="w-full p-2 bg-gray-700 rounded"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 py-2 rounded"
        >
          {loading ? 'Registering…' : 'Register'}
        </button>
      </form>

      <p className="mt-6 text-sm text-gray-400">
        Contact:{' '}
        <a href="mailto:info@tullyedmvibe.com" className="underline">
          info@tullyedmvibe.com
        </a>{' '}
        for browser extension file and instructions
      </p>
    </div>
  )
}
