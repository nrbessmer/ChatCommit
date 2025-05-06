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
  // allow “NEXT_PUBLIC_API_BASE=https://some-other-backend” at build time
  process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
  'https://chatcommit.fly.dev';

/* Shared axios instance */
export const api = axios.create({ baseURL: API_BASE });

/* ----------------------------------------------------------
   Branches
   ---------------------------------------------------------- */
export const fetchBranches      = () => api.get('/branch/');            // GET list
export const fetchBranch        = (id: number) => api.get(`/branch/${id}`);
export const createBranch       = (name: string, baseId?: number) =>
  api.post('/branch/', { name, base_commit_id: baseId });

/* ----------------------------------------------------------
   Commits
   ---------------------------------------------------------- */
export const fetchBranchCommits = (branchId: number) =>
  api.get(`/branch/${branchId}/commits`);
/* legacy alias – remove once every import is switched */
export const fetchCommits = fetchBranchCommits;
export const fetchCommit        = (id: number) => api.get(`/commit/${id}`);
export const createCommit       = (data: {
  commit_message: string;
  conversation_context: any;
  branch_id?: number;
}) => api.post('/commit/', data);

/* ----------------------------------------------------------
   Rollback
   ---------------------------------------------------------- */
export const rollbackBranch = (branchId: number, commitId: number) =>
  api.post(`/rollback/${branchId}/${commitId}`);

/* ----------------------------------------------------------
   Tags
   ---------------------------------------------------------- */
export const fetchTags          = () => api.get('/tag/');               // GET list of all tags
export const fetchCommitTags    = (commitId: number) => api.get(`/tag/commit/${commitId}`);
export const fetchBranchTags    = (branchId: number) => api.get(`/tag/branch/${branchId}`);
export const createTag          = (name: string, commitId: number) =>
  api.post('/tag/', { name, commit_id: commitId });

/* ----------------------------------------------------------
   Merge
   ---------------------------------------------------------- */
export const mergeBranches = (sourceId: number, targetId: number) =>
  api.post('/merge', null, { params: { source_branch_id: sourceId, target_branch_id: targetId } });

/* ----------------------------------------------------------
   Timeline
   ---------------------------------------------------------- */
export const fetchTimeline = (params?: {
  branch_id?: number;
  tag?: string;
  start_date?: string;  // ISO‑8601
  end_date?: string;    // ISO‑8601
}) => api.get('/timeline', { params });
