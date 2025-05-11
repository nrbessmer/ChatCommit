
// frontend/lib/api.ts

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

/* ──────────────────────────────────────────────────────────
   Types
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
   Git Operations
────────────────────────────────────────────────────────── */
export const fetchBranches = (): Promise<Branch[]> =>
  api.get<Branch[]>('/branch/').then(res => res.data)

export const fetchBranch = (id: number): Promise<Branch> =>
  api.get<Branch>(`/branch/${id}`).then(res => res.data)

export const createBranch = (
  name: string,
  baseId?: number
): Promise<Branch> =>
  api.post<Branch>('/branch/', { name, base_commit_id: baseId }).then(res => res.data)

export const fetchBranchCommits = (branchId: number): Promise<Commit[]> =>
  api.get<Commit[]>(`/branch/${branchId}/commits`).then(res => res.data)

export const fetchCommit = (id: number): Promise<Commit> =>
  api.get<Commit>(`/commit/${id}`).then(res => res.data)

export const createCommit = (payload: {
  commit_message: string
  conversation_context: any
  branch_id?: number
}): Promise<Commit> => api.post<Commit>('/commit/', payload).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Timeline
────────────────────────────────────────────────────────── */
export const fetchTimeline = (params?: {
  branch_id?: number
  tag?: string
  start_date?: string
  end_date?: string
}): Promise<Commit[]> => api.get<Commit[]>('/timeline/', { params }).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Tags
────────────────────────────────────────────────────────── */
export const fetchTags = (): Promise<Tag[]> =>
  api.get<Tag[]>('/tag/').then(res => res.data)

export const fetchCommitTags = (commitId: number): Promise<Tag[]> =>
  api.get<Tag[]>(`/tag/commit/${commitId}`).then(res => res.data)

export const fetchBranchTags = (branchId: number): Promise<Tag[]> =>
  api.get<Tag[]>(`/tag/branch/${branchId}`).then(res => res.data)

export const createTag = (name: string, commitId: number): Promise<Tag> =>
  api.post<Tag>('/tag/', { name, commit_id: commitId }).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Merge & Rollback
────────────────────────────────────────────────────────── */
export const mergeBranches = (
  sourceId: number,
  targetId: number
): Promise<{ message: string; merged_commits: string[] }> =>
  api
    .post<{ message: string; merged_commits: string[] }>(
      `/merge/${sourceId}/${targetId}`
    )
    .then(res => res.data)

export const rollbackBranch = (
  branchId: number,
  commitId: number
): Promise<{ message: string }> =>
  api.post<{ message: string }>(`/rollback/${branchId}/${commitId}`).then(res => res.data)

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
