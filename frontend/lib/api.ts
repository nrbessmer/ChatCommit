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

/* ──────────────────────────────────────────────────────────
   Branches
────────────────────────────────────────────────────────── */
export const fetchBranches = (): Promise<Branch[]> =>
  api.get<Branch[]>('/branch/').then(res => res.data)

export const fetchBranchCommits = (branchId: number): Promise<Commit[]> =>
  api.get<Commit[]>(`/branch/${branchId}/commits`).then(res => res.data)

/* ──────────────────────────────────────────────────────────
   Commits
────────────────────────────────────────────────────────── */
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
export const fetchTimeline = (params?: {
  branch_id?: number
  tag?: string
  start_date?: string
  end_date?: string
}): Promise<Commit[]> =>
  api.get<Commit[]>('/timeline', { params }).then(res => res.data)

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
   Merge & Rollback (left as exercise)
────────────────────────────────────────────────────────── */
