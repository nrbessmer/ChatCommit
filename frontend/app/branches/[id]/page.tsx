'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import CommitCard from '@/components/CommitCard';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
}

interface Branch {
  id: number;
  name: string;
  current_commit_id: number | null;
}

export default function BranchDetailPage() {
  const { id } = useParams() as { id: string };
  const branchId = id;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId) return;

    setLoading(true);
    setError('');

    Promise.all([
      axios.get<Branch>(`/api/branch/${branchId}`),
      axios.get<Commit[]>(`/api/branch/${branchId}/commits`),
    ])
      .then(([branchRes, commitsRes]) => {
        setBranch(branchRes.data);
        setCommits(commitsRes.data);
      })
      .catch(err => {
        console.error('Error fetching branch or commits:', err);
        setError('Failed to load branch details.');
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-white">
        <p>Loading branch details…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-red-500">
        <p>{error}</p>
      </div>
    );
  }

  if (!branch) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-white">
        <p>Branch not found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Branch: {branch.name}</h2>
      <p className="mb-6 text-sm text-gray-400">
        HEAD Commit ID: {branch.current_commit_id ?? 'None'}
      </p>

      {commits.length > 0 ? (
        commits.map(commit => <CommitCard key={commit.id} {...commit} />)
      ) : (
        <p className="text-gray-400">No commits found for this branch.</p>
      )}
    </div>
  );
}
