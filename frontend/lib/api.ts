// lib/api.ts

import axios from 'axios'

/* ──────────────────────────────────────────────────────────
   Base URL
────────────────────────────────────────────────────────── */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://chatcommit.fly.dev'

export const api = axios.create({ baseURL: API_BASE })

// ──────────────────────────────────────────────────────────
// Inject JWT from localStorage into Authorization header
api.interceptors.request.use(config => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token')
    if (token) {
      config.headers = config.headers ?? {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

/* ──────────────────────────────────────────────────────────
   Shared Types
────────────────────────────────────────────────────────── */
export interface Commit {
  id: number
  commit_hash: string
  commit_message: string
  created_at: string
  branch_id?: number
}

export interface Branch {
  id: number
  name: string
  current_commit_id?: number | null
}

export interface Tag {
  id: number
  name: string
  commit_id: number
}

/* ──────────────────────────────────────────────────────────
   User / Auth
────────────────────────────────────────────────────────── */
export interface UserRegisterPayload {
  full_name: string
  address: string
  email: string
  company: string
  password: string
}

export interface UserLoginPayload {
  email: string
  password: string
}

export interface AuthResponse {
  access_token: string
  token_type: string
}

export interface UserProfile {
  id: number
  full_name: string
  address: string
  email: string
  company: string
  subscribed: boolean
  date_subscribed?: string
  date_subscription_expires?: string
}

export interface RegisterResponse extends UserProfile {
  access_token: string
  token_type: string
}

// Register a new user
export const registerUser = (
  data: UserRegisterPayload
): Promise<RegisterResponse> =>
  api.post<RegisterResponse>('/auth/users/register', data)
    .then(res => {
      // Store the token immediately
      if (res.data.access_token) {
        localStorage.setItem('auth_token', res.data.access_token)
        localStorage.setItem('user_email', res.data.email)
      }
      return res.data
    })

// Activate account
export const activateUser = (
  email: string,
  token: string
): Promise<{ message: string }> =>
  api
    .post<{ message: string }>('/auth/users/activate', { email, token })
    .then(res => res.data)

// OAuth2 form‑data token (for Postman, curl, etc.)
export const loginWithForm = (
  username: string,
  password: string
): Promise<AuthResponse> =>
  api
    .post<AuthResponse>('/auth/users/token', undefined, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      params: { username, password },
    })
    .then(res => {
      const { access_token, token_type } = res.data
      // persist for interceptor
      localStorage.setItem('auth_token', access_token)
      return { access_token, token_type }
    })

// JSON login shim
export const loginUser = (data: UserLoginPayload): Promise<AuthResponse> =>
  api.post<AuthResponse>('/auth/users/login', data)
    .then(res => {
      const { access_token, token_type } = res.data
      // persist for interceptor
      localStorage.setItem('auth_token', access_token)
      return { access_token, token_type }
    })

// Fetch current user's profile (requires Authorization header)
export const fetchUserProfile = (): Promise<UserProfile> =>
  api.get<UserProfile>('/users/me').then(res => res.data)

// Request extension install instructions
export const sendExtensionInstructions = (): Promise<void> =>
  api.post<void>('/users/extension-instructions').then(res => res.data)

/* …rest of your file unchanged… */
