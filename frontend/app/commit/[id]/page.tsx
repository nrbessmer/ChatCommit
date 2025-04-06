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

  if (loading) return <p className="p-6 text-gray-300 bg-gray-900">Loading commit…</p>;
  if (error)   return <p className="p-6 text-red-400 bg-gray-900">{error}</p>;
  if (!commit) return <p className="p-6 text-gray-300 bg-gray-900">Commit not found.</p>;

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 p-6">
      <div className="max-w-3xl mx-auto bg-gray-800 rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4 text-white">Commit Details</h2>

        <CommitCard {...commit} hideView />

        {/* Conversation Context */}
        {commit.conversation_context?.messages && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold mb-2 text-white">Conversation Context</h3>
            <div className="bg-gray-700 p-4 rounded overflow-y-auto max-h-64 text-gray-200 font-mono text-sm">
              {commit.conversation_context.messages.map((msg, idx) => (
                <p key={idx} className="mb-2">
                  {msg}
                </p>
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
    </div
