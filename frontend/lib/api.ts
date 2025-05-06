// frontend/lib/api.ts
// ------------------------------------------------------------
// Central place for every HTTP call to the FastAPI backend.
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
   Types (you can move these to a separate types.ts if you prefer)
   ---------------------------------------------------------- */
export interface Branch {
  id: number;
  name: string;
  current_commit_id?: number;
}

export interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
  conversation_context?: any;
}

export interface Tag {
  id: number;
  name: string;
  commit_id: number;
}

/* ----------------------------------------------------------
   Branches
   ---------------------------------------------------------- */
export const fetchBranches = () => api.get<Branch[]>('/branch/');             // GET list
export const fetchBranch   = (id: number) => api.get<Branch>(`/branch/${id}`);
export const createBranch  = (name: string, base_commit_id?: number) =>
  api.post<Branch>('/branch/', { name, base_commit_id });

/* ----------------------------------------------------------
   Commits
   ---------------------------------------------------------- */
export const fetchBranchCommits = (branchId: number) =>
  api.get<Commit[]>(`/branch/${branchId}/commits`);
export const fetchCommit = (id: number) =>
  api.get<Commit>(`/commit/${id}`);
export const createCommit = (data: {
  commit_message: string;
  conversation_context: any;
  branch_id?: number;
}) =>
  api.post<Commit>('/commit/', data);

/* ----------------------------------------------------------
   Rollback
   ---------------------------------------------------------- */
export const rollbackBranch = (branchId: number, commitId: number) =>
  api.post(`/rollback/${branchId}/${commitId}`);

/* ----------------------------------------------------------
   Tags
   ---------------------------------------------------------- */
export const fetchTags       = () => api.get<Tag[]>('/tag/');
export const fetchCommitTags = (commitId: number) =>
  api.get<Tag[]>(`/tag/commit/${commitId}`);
export const fetchBranchTags = (branchId: number) =>
  api.get<Tag[]>(`/tag/branch/${branchId}`);
export const createTag = (name: string, commit_id: number) =>
  api.post<Tag>('/tag/', { name, commit_id });

/* ----------------------------------------------------------
   Merge
   ---------------------------------------------------------- */
export const mergeBranches = (
  source_branch_id: number,
  target_branch_id: number
) =>
  api.post(
    '/merge',
    null,
    { params: { source_branch_id, target_branch_id } }
  );

/* ----------------------------------------------------------
   Timeline
   ---------------------------------------------------------- */
export const fetchTimeline = (params?: {
  branch_id?: number;
  tag?: string;
  start_date?: string; // ISO‑8601
  end_date?: string;   // ISO‑8601
}) =>
  api.get<Commit[]>('/timeline', { params });
