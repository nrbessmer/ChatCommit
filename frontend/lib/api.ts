// frontend/lib/api.ts
// ------------------------------------------------------------
// Central place for every HTTP call to the FastAPI backend.
// Every helper returns the _data_ payload directly (not AxiosResponse).
// ------------------------------------------------------------

import axios from 'axios'

/* ──────────────────────────────────────────────────────────
   Base URL
────────────────────────────────────────────────────────── */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://chatcommit.fly.dev'

export const api = axios.create({ baseURL: API_BASE })


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
  token: string
  expires_at?: string    // optional expiry timestamp
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

// Register a new user
export const registerUser = (data: UserRegisterPayload): Promise<AuthResponse> =>
  api.post<AuthResponse>('/users/register', data).then(res => res.data)

// (old qs import left in place but no longer used)
import qs from 'qs'

export const loginUser = async (data: UserLoginPayload): Promise<AuthResponse> => {
  // form‑encode with URLSearchParams instead of qs
  const params = new URLSearchParams()
  params.append('username', data.email)
  params.append('password', data.password)
  params.append('grant_type', 'password')

  const res = await api.post<AuthResponse>(
    '/auth/token',
    params.toString(),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  )
  return res.data
}

// Fetch current user's profile (requires Authorization header)
export const fetchUserProfile = (): Promise<UserProfile> =>
  api.get<UserProfile>('/users/me', {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const sendExtensionInstructions = (): Promise<void> =>
  api.post<void>('/users/extension-instructions', undefined, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)


/* ──────────────────────────────────────────────────────────
   Subscription
────────────────────────────────────────────────────────── */
export interface SubscriptionPayload {
  // this will come from Stripe.js after collecting payment method
  paymentMethodId: string
  planId: string
}

export interface SubscriptionResponse {
  subscribed: boolean
  date_subscribed: string
  date_subscription_expires: string
}

// Create or update subscription
export const createSubscription = (
  data: SubscriptionPayload
): Promise<SubscriptionResponse> =>
  api.post<SubscriptionResponse>('/subscription', data, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

// Fetch current subscription status
export const fetchSubscription = (): Promise<SubscriptionResponse> =>
  api.get<SubscriptionResponse>('/subscription', {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)


/* ──────────────────────────────────────────────────────────
   Branches
────────────────────────────────────────────────────────── */
export const fetchBranches = (): Promise<Branch[]> =>
  api.get<Branch[]>('/branch/', {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const fetchBranch = (id: number): Promise<Branch> =>
  api.get<Branch>(`/branch/${id}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const createBranch = (name: string, baseId?: number): Promise<Branch> =>
  api.post<Branch>(
    '/branch/',
    { name, base_commit_id: baseId },
    { headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` } }
  ).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Commits
────────────────────────────────────────────────────────── */
export const fetchBranchCommits = (branchId: number): Promise<Commit[]> =>
  api.get<Commit[]>(`/branch/${branchId}/commits`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const fetchCommit = (id: number): Promise<Commit> =>
  api.get<Commit>(`/commit/${id}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const createCommit = (payload: {
  commit_message: string
  conversation_context: any
  branch_id?: number
}): Promise<Commit> =>
  api.post<Commit>('/commit/', payload, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Timeline
────────────────────────────────────────────────────────── */
export const fetchTimeline = (params?: {
  branch_id?: number
  tag?: string
  start_date?: string  // ISO‑8601
  end_date?: string    // ISO‑8601
}): Promise<Commit[]> =>
  api.get<Commit[]>('/timeline', {
    params,
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Tags
────────────────────────────────────────────────────────── */
export const fetchTags = (): Promise<Tag[]> =>
  api.get<Tag[]>('/tag/', {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const fetchCommitTags = (commitId: number): Promise<Tag[]> =>
  api.get<Tag[]>(`/tag/commit/${commitId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const fetchBranchTags = (branchId: number): Promise<Tag[]> =>
 api.get<Tag[]>(`/tag/branch/${branchId}`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

export const createTag = (name: string, commitId: number): Promise<Tag> =>
  api.post<Tag>('/tag/', { name, commit_id: commitId }, {
    headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
  }).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Merge & Rollback
────────────────────────────────────────────────────────── */
export const mergeBranches = (
  sourceId: number,
  targetId: number
): Promise<{ message: string; merged_commits: string[] }> =>
  api
    .post('/merge', null, {
      params: { source_branch_id: sourceId, target_branch_id: targetId },
      headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` }
    })
    .then(res => res.data)

export const rollbackBranch = (
  branchId: number,
  commitId: number
): Promise<{ message: string }> =>
  api.post<{ message: string }>(
    `/rollback/${branchId}/${commitId}`,
    null,
    { headers: { Authorization: `Bearer ${localStorage.getItem('chatcommit_auth_token')}` } }
  ).then(res => res.data)
