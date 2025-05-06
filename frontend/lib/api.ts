// frontend/lib/api.ts
// ------------------------------------------------------------
// Central place for every HTTP call to the FastAPI backend.
//
// • All helper functions return axios promises → .then(res => res.data)
// • Every collection‑style endpoint *must* have a trailing “/” to
//   skip FastAPI’s automatic 307 redirect (axios + CORS dislike it).
// ------------------------------------------------------------

import axios from 'axios';

/* ----------------------------------------------------------
   Base URL
   ---------------------------------------------------------- */
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://chatcommit.fly.dev';

/* Shared axios instance */
export const api = axios.create({ baseURL: API_BASE });

/* ----------------------------------------------------------
   Branches
   ---------------------------------------------------------- */
export const fetchBranches = () =>
  api.get('/branch/').then(res => res.data);

export const fetchBranch = (id: number) =>
  api.get(`/branch/${id}`).then(res => res.data);

export const createBranch = (name: string, baseId?: number) =>
  api.post('/branch/', { name, base_commit_id: baseId }).then(res => res.data);

/* ----------------------------------------------------------
   Commits
   ---------------------------------------------------------- */
export interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
}

export const fetchBranchCommits = (branchId: number) =>
  api.get<Commit[]>(`/branch/${branchId}/commits`).then(res => res.data);

// alias for compatibility
export const fetchCommits = fetchBranchCommits;

export const fetchCommit = (id: number) =>
  api.get<Commit>(`/commit/${id}`).then(res => res.data);

export const createCommit = (data: {
  commit_message: string;
  conversation_context: any;
  branch_id?: number;
}) => api.post('/commit/', data).then(res => res.data);

/* ----------------------------------------------------------
   Rollback
   ---------------------------------------------------------- */
export const rollbackBranch = (branchId: number, commitId: number) =>
  api.post(`/rollback/${branchId}/${commitId}`).then(res => res.data);

/* ----------------------------------------------------------
   Tags
   ---------------------------------------------------------- */
export const fetchTags = () =>
  api.get<{ id: number; name: string; commit_id: number }[]>('/tag/').then(res => res.data);

export const fetchCommitTags = (commitId: number) =>
  api.get<{ id: number; name: string; commit_id: number }[]>(`/tag/commit/${commitId}`).then(res => res.data);

export const fetchBranchTags = (branchId: number) =>
  api.get<{ id: number; name: string; commit_id: number }[]>(`/tag/branch/${branchId}`).then(res => res.data);

export const createTag = (name: string, commitId: number) =>
  api.post('/tag/', { name, commit_id: commitId }).then(res => res.data);

/* ----------------------------------------------------------
   Merge
   ---------------------------------------------------------- */
export const mergeBranches = (sourceId: number, targetId: number) =>
  api
    .post(
      '/merge',
      null,
      { params: { source_branch_id: sourceId, target_branch_id: targetId } }
    )
    .then(res => res.data);

/* ----------------------------------------------------------
   Timeline
   ---------------------------------------------------------- */
export const fetchTimeline = (params?: {
  branch_id?: number;
  tag?: string;
  start_date?: string; // ISO‑8601
  end_date?: string;   // ISO‑8601
}) => api.get<Commit[]>('/timeline', { params }).then(res => res.data);
