// ------------------------------------------------------------
// Central place for every HTTP call to the FastAPI backend.
// Every helper returns the _data_ payload directly (not AxiosResponse).
// ------------------------------------------------------------

import axios from 'axios'

/* ──────────────────────────────────────────────────────────
   Base URL & Config
────────────────────────────────────────────────────────── */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://chatcommit.fly.dev'

export const api = axios.create({ baseURL: API_BASE })

// Add request interceptor for auth token
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

// Add response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Clear invalid token
      localStorage.removeItem('auth_token')
    }
    return Promise.reject(error)
  }
)

/* ──────────────────────────────────────────────────────────
   Types
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

export interface SubscriptionPayload {
  email: string
  paymentMethodId: string
  planId: string
}

export interface SubscriptionResponse {
  subscribed: boolean
  date_subscribed: string | null
  date_subscription_expires: string | null
  requires_action: boolean
  payment_intent_client_secret: string | null
}

/* ──────────────────────────────────────────────────────────
   Auth API Calls
────────────────────────────────────────────────────────── */
export const registerUser = (
  data: UserRegisterPayload
): Promise<RegisterResponse> =>
  api.post<RegisterResponse>('/auth/users/register', data)
    .then(res => {
      // Store auth token and email
      if (res.data.access_token) {
        localStorage.setItem('auth_token', res.data.access_token)
        localStorage.setItem('user_email', res.data.email)
      }
      return res.data
    })

export const loginUser = (data: UserLoginPayload): Promise<AuthResponse> =>
  api.post<AuthResponse>('/auth/users/login', data)
    .then(res => {
      if (res.data.access_token) {
        localStorage.setItem('auth_token', res.data.access_token)
        localStorage.setItem('user_email', data.email)
      }
      return res.data
    })

export const fetchUserProfile = (): Promise<UserProfile> =>
  api.get<UserProfile>('/users/me').then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Subscription API Calls
────────────────────────────────────────────────────────── */
export const createSubscription = (
  data: SubscriptionPayload
): Promise<SubscriptionResponse> =>
  api.post<SubscriptionResponse>('/subscription/', data)
    .then(res => res.data)

export const fetchSubscription = (): Promise<SubscriptionResponse> =>
  api.get<SubscriptionResponse>('/subscription/')
    .then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Stripe Config
────────────────────────────────────────────────────────── */
export interface StripeConfig {
  publishableKey: string
  priceId: string
}

export const getStripeConfig = (): Promise<StripeConfig> =>
  api.get<StripeConfig>('/stripe/config')
    .then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Helper Functions
────────────────────────────────────────────────────────── */
export const isAuthenticated = (): boolean => {
  if (typeof window === 'undefined') return false
  return !!localStorage.getItem('auth_token')
}

export const logout = (): void => {
  if (typeof window === 'undefined') return
  localStorage.removeItem('auth_token')
  localStorage.removeItem('user_email')
}

/* ──────────────────────────────────────────────────────────
   Debug Functions (remove in production)
────────────────────────────────────────────────────────── */
export const testStripeConfig = (): Promise<any> =>
  api.get('/subscription/test-stripe')
    .then(res => res.data)
