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

export default function CommitDetailPage() {
  const { id } = useParams() as { id: string };
  const [commit, setCommit] = useState<Commit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    axios.get<Commit>(`/api/commit/${id}`)
      .then(res => setCommit(res.data))
      .catch(() => setError('Failed to load commit.'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6">Loading commit…</p>;
  if (error)   return <p className="p-6 text-red-500">{error}</p>;
  if (!commit) return <p className="p-6">Commit not found.</p>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <CommitCard {...commit} />
    </div>
  );
}
