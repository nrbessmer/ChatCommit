'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
}

export default function HomePage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);

  // Load branch ID from localStorage
  useEffect(() => {
    const storedBranchId = localStorage.getItem('activeBranchId');
    if (storedBranchId) {
      setActiveBranchId(Number(storedBranchId));
    }
  }, []);

  // Fetch commits for the active branch
  useEffect(() => {
    if (activeBranchId !== null) {
      axios
        .get<Commit[]>(`https://chatcommit.fly.dev/branch/${activeBranchId}/commits`)
        .then((res) => {
          setCommits(res.data);
        })
        .catch((err: unknown) => {
          console.error('Error fetching commits:', err);
          setError('Failed to load commits.');
        })
        .finally(() => setLoading(false));
    }
  }, [activeBranchId]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">
        Commits for Branch {activeBranchId ?? '(none selected)'}
      </h2>

      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {commits.length > 0 ? (
        commits.map((commit) => (
          <div
            key={commit.id}
            className="border p-4 mb-3 rounded bg-white shadow-sm"
          >
            <div className="text-sm font-mono text-gray-700">
              {commit.commit_hash}
            </div>
            <div className="text-md font-semibold my-1">
              {commit.commit_message}
            </div>
            <div className="text-xs text-gray-500">
              {new Date(commit.created_at).toLocaleString()}
            </div>
          </div>
        ))
      ) : (
        !loading && <p className="text-gray-500">No commits found for this branch.</p>
      )}
    </div>
  );
}
