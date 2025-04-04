'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
}

export default function HomePage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branchId, setBranchId] = useState<number>(1); // Default to main branch
  const [rollbackStatus, setRollbackStatus] = useState<string>('');

  useEffect(() => {
    axios
      .get(`https://chatcommit.fly.devbranch/${branchId}/commits`)
      .then((res) => setCommits(res.data))
      .catch((err) =>
        console.error('Error fetching branch commits:', err)
      );
  }, [branchId]);

  const handleRollback = async (commitId: number) => {
    const confirm = window.confirm(
      'Are you sure you want to roll back this branch to this commit?'
    );
    if (!confirm) return;

    try {
      const res = await axios.post(
        `https://chatcommit.fly.dev:8000/rollback/${branchId}/${commitId}`
      );
      setRollbackStatus(res.data.message);
      // Optionally, refetch commits after rollback
      const updated = await axios.get(
        `https://chatcommit.fly.dev:8000/branch/${branchId}/commits`
      );
      setCommits(updated.data);
    } catch (err: any) {
      setRollbackStatus(
        err.response?.data?.detail || 'Failed to rollback commit.'
      );
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">
        Commits for Branch <span className="text-blue-600">ID {branchId}</span>
      </h2>

      {rollbackStatus && (
        <div className="mb-4 p-3 bg-blue-100 text-blue-800 rounded">
          {rollbackStatus}
        </div>
      )}

      {commits.length > 0 ? (
        commits.map((commit) => (
          <div
            key={commit.id}
            className="border p-4 mb-3 rounded shadow-sm bg-white"
          >
            <div className="font-mono text-sm text-gray-700">
              {commit.commit_hash}
            </div>
            <div className="font-semibold text-md my-1">
              {commit.commit_message}
            </div>
            <div className="text-xs text-gray-500 mb-2">
              {new Date(commit.created_at).toLocaleString()}
            </div>
            <button
              onClick={() => handleRollback(commit.id)}
              className="bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 text-sm"
            >
              Rollback to this
            </button>
          </div>
        ))
      ) : (
        <p className="text-gray-500">No commits found for this branch.</p>
      )}
    </div>
  );
}
