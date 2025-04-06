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
  branch_id?: number;
  tags?: string[];
  conversation_context?: { messages: string[] };
}

interface Branch {
  id: number;
  name: string;
  current_commit_id: number | null;
}

export default function BranchDetailPage() {
  const { id } = useParams() as { id: string };
  const [branch, setBranch] = useState<Branch | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    Promise.all([
      axios.get<Branch>(`https://chatcommit.fly.dev/branch/${id}`),
      axios.get<Commit[]>(`https://chatcommit.fly.dev/branch/${id}/commits`)
    ])
      .then(([b, c]) => {
        setBranch(b.data);
        setCommits(c.data);
      })
      .catch(() => setError('Failed to load branch details.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 text-white">Loading branch details…</p>;
  if (error)   return <p className="p-6 text-red-500">{error}</p>;
  if (!branch) return <p className="p-6 text-white">Branch not found.</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Branch: {branch.name}</h2>
      <p className="text-sm text-gray-400 mb-6">
        HEAD Commit ID: {branch.current_commit_id ?? 'None'}
      </p>
      {commits.map(c => (
        <CommitCard key={c.id} {...c} hideView />
      ))}
    </div>
  );
}
