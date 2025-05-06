// app/page.tsx
'use client';

import { useEffect, useState } from 'react';
import CommitCard from '../components/CommitCard';
import { fetchBranchCommits } from '../lib/api';

type Commit = {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
};

export default function HomePage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);

  // Load branch ID from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('activeBranchId');
    if (stored) {
      setActiveBranchId(Number(stored));
    } else {
      setLoading(false);
    }
  }, []);

  // Fetch commits whenever activeBranchId changes
  useEffect(() => {
    if (activeBranchId === null) return;

    setLoading(true);
    fetchBranchCommits(activeBranchId)
      .then((response) => {
        setCommits(response);
        setError('');
      })
      .catch((err) => {
        console.error('Error fetching commits:', err);
        setError('Failed to load commits.');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [activeBranchId]);

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">
        Commits for Branch {activeBranchId ?? '(none selected)'}
      </h2>

      {loading && <p className="text-gray-500">Loading...</p>}
      {error && <p className="text-red-500">{error}</p>}

      {!loading && !error && (
        commits.length > 0 ? (
          commits.map((commit) => (
            <CommitCard
              key={commit.id}
              id={commit.id}
              commit_hash={commit.commit_hash}
              commit_message={commit.commit_message}
              created_at={commit.created_at}
            />
          ))
        ) : (
          <p className="text-gray-500">No commits found for this branch.</p>
        )
      )}
    </div>
  );
}
