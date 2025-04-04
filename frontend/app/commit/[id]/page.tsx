'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import TagForm from '@/components/TagForm';

interface CommitData {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  conversation_context: {
    messages: string[];
  };
}

interface Tag {
  id: number;
  name: string;
  commit_id: number;
}

export default function CommitDetailPage() {
  const params = useParams();
  const commitId = params.id?.toString();
  const [commit, setCommit] = useState<CommitData | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!commitId) {
      setLoading(false);
      return;
    }

    axios
      .get(`https://chatcommit.fly.dev/commit/${commitId}`)
      .then((res) => setCommit(res.data))
      .catch((err) => console.error('Error fetching commit:', err));

    axios
      .get(`https://chatcommit.fly.dev/tag/commit/${commitId}`)
      .then((res) => setTags(res.data))
      .catch((err) => console.error('Error fetching tags:', err))
      .finally(() => setLoading(false));
  }, [commitId]);

  // Refresh tags after creation
  const refreshTags = async () => {
    if (!commitId) return;
    try {
      const res = await axios.get(`https://chatcommit.fly.dev/tag/commit/${commitId}`);
      setTags(res.data);
    } catch (err) {
      console.error('Error refreshing tags:', err);
    }
  };

  if (loading) {
    return <p className="p-6 text-white">Loading...</p>;
  }
  if (!commit) {
    return <p className="p-6 text-red-500">Commit not found.</p>;
  }

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-md">
      <h1 className="text-2xl font-bold mb-4">Commit Details</h1>

      <div className="p-4 rounded border border-gray-700 bg-gray-800">
        {/* basic commit info */}
        <p className="text-gray-400 text-sm mb-1">Commit Hash:</p>
        <p className="font-mono text-blue-300 text-sm">{commit.commit_hash}</p>

        <p className="mt-4 text-gray-400 text-sm mb-1">Message:</p>
        <p className="text-lg font-semibold text-gray-100">{commit.commit_message}</p>

        <p className="mt-4 text-gray-400 text-sm mb-1">Created At:</p>
        <p className="text-sm text-gray-200">
          {new Date(commit.created_at).toLocaleString()}
        </p>

        {/* Tag form */}
        <div className="mt-6">
          <TagForm
            commitId={commit.id}
            onCreated={refreshTags}
          />
        </div>

        {/* existing tags */}
        <div className="mt-4">
          <p className="text-sm text-gray-400 mb-1 font-semibold">Tags:</p>
          {tags.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag.id}
                  className="bg-yellow-600 text-yellow-100 text-xs font-semibold px-2 py-1 rounded-full"
                >
                  #{tag.name}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">No tags for this commit.</p>
          )}
        </div>

        {/* conversation context */}
        {commit.conversation_context?.messages?.length > 0 && (
          <div className="mt-4">
            <p className="text-sm text-gray-400 mb-1 font-semibold">
              Conversation Context
            </p>
            <div className="bg-gray-700 border border-gray-600 p-3 rounded text-sm leading-relaxed text-gray-100">
              {commit.conversation_context.messages.map((msg, i) => (
                <p key={i} className="mb-2">
                  {msg}
                </p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
