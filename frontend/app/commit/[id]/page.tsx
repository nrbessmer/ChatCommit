'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import CommitCard from '@/components/CommitCard';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
}

export default function CommitDetailPage() {
  const { id } = useParams() as { id: string };
  const [commit, setCommit] = useState<Commit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (!id) return;
    axios.get<Commit>(`https://chatcommit.fly.dev/commit/${id}`)
      .then(res => setCommit(res.data))
      .catch(err => {
        console.error('Error fetching commit:', err);
        setError('Failed to load commit.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 text-white">Loading commit…</p>;
  if (error)   return <p className="p-6 text-red-500">{error}</p>;
  if (!commit) return <p className="p-6 text-white">Commit not found.</p>;

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Commit Details</h2>

      {/* Hide the default View button */}
      <CommitCard {...commit} hideView />

      {/* Back to Branch link */}
      {commit.branch_id && (
        <button
          onClick={() => router.push(`/branches/${commit.branch_id}`)}
          className="mt-4 text-blue-400 hover:underline"
        >
          ← Back to Branch
        </button>
      )}
    </div>
  );
}
