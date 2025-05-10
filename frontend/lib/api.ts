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

// ──────────────────────────────────────────────────────────
// Inject JWT from localStorage into Authorization header
api.interceptors.request.use((config) => {
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

// Register a new user
export const registerUser = (
  data: UserRegisterPayload
): Promise<UserProfile> =>
  api
    .post<UserProfile>('/auth/users/register', data)
    .then(res => res.data)

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
      params: { username, password }
    })
    .then(res => res.data)

// JSON login shim
export const loginUser = (
  data: UserLoginPayload
): Promise<AuthResponse> =>
  api
    .post<AuthResponse>('/auth/users/login', data)
    .then(res => res.data)

// Fetch current user's profile (requires Authorization header)
export const fetchUserProfile = (): Promise<UserProfile> =>
  api
    .get<UserProfile>('/users/me')
    .then(res => res.data)

// Request extension install instructions
export const sendExtensionInstructions = (): Promise<void> =>
  api.post<void>('/users/extension-instructions').then(res => res.data)


/* ──────────────────────────────────────────────────────────
   Subscription
────────────────────────────────────────────────────────── */
export interface SubscriptionPayload {
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
  api
    .post<SubscriptionResponse>('/subscription/', data)
    .then(res => res.data)

// Fetch current subscription status
export const fetchSubscription = (): Promise<SubscriptionResponse> =>
  api.get<SubscriptionResponse>('/subscription/').then(res => res.data)


/* ──────────────────────────────────────────────────────────
   Branches
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


/* ──────────────────────────────────────────────────────────
   Commits
────────────────────────────────────────────────────────── */
export const fetchBranchCommits = (branchId: number): Promise<Commit[]> =>
  api.get<Commit[]>(`/branch/${branchId}/commits`).then(res => res.data)

export const fetchCommit = (id: number): Promise<Commit> =>
  api.get<Commit>(`/commit/${id}`).then(res => res.data)

export const createCommit = (payload: {
  commit_message: string
  conversation_context: any
  branch_id?: number
}): Promise<Commit> =>
  api.post<Commit>('/commit/', payload).then(res => res.data)


/* ──────────────────────────────────────────────────────────
   Timeline
────────────────────────────────────────────────────────── */
// Note the trailing slash on timeline to avoid redirects!
export const fetchTimeline = (params?: {
  branch_id?: number
  tag?: string
  start_date?: string  // ISO‑8601
  end_date?: string    // ISO‑8601
}): Promise<Commit[]> =>
  api.get<Commit[]>('/timeline/', { params }).then(res => res.data)


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
// Merge source into target (path‑style)
export const mergeBranches = (
  sourceId: number,
  targetId: number
): Promise<{ message: string; merged_commits: string[] }> =>
  api
    .post<{ message: string; merged_commits: string[] }>(
      `/merge/${sourceId}/${targetId}`
    )
    .then(res => res.data)

// Roll back a branch
export const rollbackBranch = (
  branchId: number,
  commitId: number
): Promise<{ message: string }> =>
  api.post<{ message: string }>(`/rollback/${branchId}/${commitId}`).then(res => res.data)
