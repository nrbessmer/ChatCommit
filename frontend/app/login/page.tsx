'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { loginUser, fetchUserProfile, api } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { token } = await loginUser({ email, password })
      // Persist token and set default header
      localStorage.setItem('authToken', token)
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`

      // Optionally fetch profile now or defer
      await fetchUserProfile()

      // Redirect to subscription if not subscribed:
      router.push('/subscription')
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-sm mx-auto p-6 bg-gray-900 text-gray-100 rounded">
      <h1 className="text-2xl mb-4">Sign In</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 p-2 rounded"
          />
        </div>
        <div>
          <label>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-800 p-2 rounded"
          />
        </div>

        {error && <p className="text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 py-2 rounded"
        >
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

