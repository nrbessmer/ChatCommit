'use client'

import { useState } from 'react'
import { loginUser } from '@/lib/api'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    setError(null)
    setLoading(true)
    try {
      const res = await loginUser({ email, password })
      localStorage.setItem('auth_token', res.token)
      router.push('/subscription') // or redirect to dashboard
    } catch (err) {
      setError('Login failed. Check your credentials.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-20 bg-gray-900 text-white p-6 rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-4 text-green-400">Login</h1>

      {error && <p className="text-red-400 mb-3">{error}</p>}

      <input
        className="w-full mb-4 p-2 bg-gray-800 border border-gray-700 rounded"
        placeholder="Email"
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        className="w-full mb-4 p-2 bg-gray-800 border border-gray-700 rounded"
        placeholder="Password"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        onClick={handleLogin}
        className="w-full py-2 bg-green-500 hover:bg-green-600 rounded disabled:opacity-50"
        disabled={loading}
      >
        {loading ? 'Logging in…' : 'Log In'}
      </button>
    </div>
  )
}
