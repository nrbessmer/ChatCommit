// frontend/lib/api.ts
import axios from 'axios';

////////////////////////////////////////////////////////////////////////////////
// 1️⃣  Base URL – keep the trailing “/” so               << IMPORTANT
//     every request we build is `/something/` not `/something`
////////////////////////////////////////////////////////////////////////////////
const API_BASE = 'https://chatcommit.fly.dev/';

////////////////////////////////////////////////////////////////////////////////
// 2️⃣  Low‑level axios instance used across the app
////////////////////////////////////////////////////////////////////////////////
export const api = axios.create({
  baseURL: API_BASE,
});

////////////////////////////////////////////////////////////////////////////////
// 3️⃣  Convenience helpers (all with *trailing* slashes)
////////////////////////////////////////////////////////////////////////////////

// Branches ----------------------------------------------------------
export const fetchBranches = async () => {
  const { data } = await api.get('/branch/');
  return data;
};

export const fetchBranchCommits = async (branchId: number) => {
  const { data } = await api.get(`/branch/${branchId}/commits/`);
  return data;
};

// Commits -----------------------------------------------------------
export const fetchCommits = async (branchId: number) =>
  fetchBranchCommits(branchId); // alias

export const createCommit = async (
  commit_message: string,
  conversation_context: any,
  branch_id?: number,
) => {
  const payload: Record<string, any> = {
    commit_message,
    conversation_context,
  };
  if (branch_id) payload.branch_id = branch_id;
  const { data } = await api.post('/commit/', payload);
  return data;
};

// Rollback ----------------------------------------------------------
export const rollbackBranch = async (branchId: number, commitId: number) => {
  const { data } = await api.post(`/rollback/${branchId}/${commitId}/`);
  return data;
};

// Tags --------------------------------------------------------------
export const fetchAllTags = async () => {
  const { data } = await api.get('/tag/');
  return data;
};

export const fetchTagsForCommit = async (commitId: number) => {
  const { data } = await api.get(`/tag/commit/${commitId}/`);
  return data;
};

export const fetchTagsForBranch = async (branchId: number) => {
  const { data } = await api.get(`/tag/branch/${branchId}/`);
  return data;
};

// Timeline ----------------------------------------------------------
export const fetchTimeline = async () => {
  const { data } = await api.get('/timeline');
  return data;
};
