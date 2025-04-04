'use client';

import { useEffect, useState } from 'react';
import CommitCard from '../components/CommitCard';
import { fetchCommits } from '../lib/api';

type Commit = {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch?: string;
};

export default function HomePage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null);

  useEffect(() => {
    const storedBranchId = localStorage.getItem('activeBranchId');
    if (storedBranchId) {
      setActiveBranchId(Number(storedBranchId));
    }
  }, []);

  useEffect(() => {
    if (activeBranchId !== null) {
      fetchCommits(activeBranchId)
        .then(setCommits)
        .catch((err) => console.error('Error fetching commits:', err));
    }
  }, [activeBranchId]);

  return (
    <div>
      <h2 className="text-xl font-bold mb-4">
        Commits for Branch {activeBranchId ?? '(none selected)'}
      </h2>
      {commits.length > 0 ? (
        commits.map((commit) => <CommitCard key={commit.id} {...commit} />)
      ) : (
        <p className="text-gray-500">No commits found for this branch.</p>
      )}
    </div>
  );
}
