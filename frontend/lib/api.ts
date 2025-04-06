import axios from 'axios';

const API_BASE = "https://chatcommit.fly.dev"; // Removed '/api' to match backend routes

// Accepts branchId and fetches commits for that branch
export const fetchCommits = async (branchId: number) => {
  const res = await axios.get(`${API_BASE}/branch/${branchId}/commits`);
  return res.data;
};

export const fetchCommitsByBranch = async (branchId: number) => {
  const res = await axios.get(`${API_BASE}/branch/${branchId}/commits`);
  return res.data;
};

export const createCommit = async (
  commit_message: string,
  conversation_context: any,
  branch_id?: number
) => {
  const payload: any = {
    commit_message,
    conversation_context,
  };
  if (branch_id) payload.branch_id = branch_id;

  const res = await axios.post(`${API_BASE}/commit/`, payload);
  return res.data;
};

export const fetchBranches = async () => {
  const res = await axios.get(`${API_BASE}/branch/`);
  return res.data;
};

export const fetchBranchCommits = async (branchId: number) => {
  const res = await axios.get(`${API_BASE}/branch/${branchId}/commits`);
  return res.data;
};

export const rollbackBranch = async (branchId: number, commitId: number) => {
  const res = await axios.post(`${API_BASE}/rollback/${branchId}/${commitId}`);
  return res.data;
};
