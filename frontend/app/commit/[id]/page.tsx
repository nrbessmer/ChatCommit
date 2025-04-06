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

  const copyContext = () => {
    if (!commit?.conversation_context) return;
    const text = JSON.stringify(commit.conversation_context, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => alert('Conversation context copied!'))
      .catch(() => alert('Failed to copy context.'));
  };

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
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold text-white">Conversation Context</h3>
              <button
                onClick={copyContext}
                aria-label="Copy conversation context"
                className="p-1 hover:text-blue-400"
              >
                {/* Copy Icon */}
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h6m4 0h2a2 2 0 012 2v8a2 2 0 01-2 2h-2M8 12h6m-6 4h6"
                  />
                </svg>
              </button>
            </div>
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
