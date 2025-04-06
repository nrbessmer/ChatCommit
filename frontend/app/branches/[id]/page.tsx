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

// Simple retry helper
async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, retries - 1, delay);
  }
}

export default function BranchDetailPage() {
  const { id } = useParams() as { id: string };
  const branchId = id;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!branchId) return;

    setLoading(true);
    setError("");

    // Fetch branch and commits in parallel with retries via proxy
    Promise.all([
      retry(() => axios.get<Branch>(`/api/branch/${branchId}`)),
      retry(() => axios.get<Commit[]>(`/api/branch/${branchId}/commits`))
    ])
      .then(([branchRes, commitsRes]) => {
        setBranch(branchRes.data);
        setCommits(commitsRes.data);
      })
      .catch(err => {
        console.error("Error loading branch details:", err);
        setError("Failed to load branch details. Please try again.");
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return <p className="p-6 text-white">Loading branch details...</p>;
  if (error)   return <p className="p-6 text-red-500">{error}</p>;
  if (!branch) return <p className="p-6 text-white">Branch not found.</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Branch: {branch.name}</h2>
      <p className="mb-6 text-sm text-gray-400">
        HEAD Commit ID: {branch.current_commit_id ?? 'None'}
      </p>

      {commits.length > 0 ? (
        commits.map(c => <CommitCard key={c.id} {...c} />)
      ) : (
        <p className="text-gray-400">No commits found for this branch.</p>
      )}
    </div>
  );
}
