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
  conversation_context?: {
    messages: string[];
  };
}

export default function CommitDetailPage() {
  const { id } = useParams() as { id: string };
  const router = useRouter();

  const [commit, setCommit] = useState<Commit | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    axios
      .get<Commit>(`https://chatcommit.fly.dev/commit/${id}`)
      .then(res => setCommit(res.data))
      .catch(err => {
        console.error('Error fetching commit:', err);
        setError('Failed to load commit.');
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p className="p-6 bg-gray-900 text-gray-300">Loading commit…</p>;
  if (error)   return <p className="p-6 bg-gray-900 text-red-500">{error}</p>;
  if (!commit) return <p className="p-6 bg-gray-900 text-gray-300">Commit not found.</p>;

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto bg-gray-800 p-6 rounded-lg shadow-xl text-gray-100">
        <h2 className="text-2xl font-bold mb-4">Commit Details</h2>

        <CommitCard {...commit} hideView />

        {/* Conversation Context */}
        {commit.conversation_context?.messages && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-white mb-2">Conversation Context</h3>
            <div className="bg-gray-700 p-4 rounded max-h-64 overflow-y-auto text-gray-200 font-mono text-sm">
              {commit.conversation_context.messages.map((msg, i) => (
                <p key={i} className="mb-2">{msg}</p>
              ))}
            </div>
          </div>
        )}

        {/* Back to Branch */}
        {commit.branch_id && (
          <button
            onClick={() => router.push(`/branches/${commit.branch_id}`)}
            className="mt-6 text-blue-400 hover:underline"
          >
            ← Back to Branch
          </button>
        )}
      </div>
    </div>
  );
}
