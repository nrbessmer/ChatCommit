'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

export default function CommitFormPage() {
  const router = useRouter();
  const [commitMessage, setCommitMessage] = useState('');
  const [context, setContext] = useState('{"messages": ["Hello", "World"]}');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const payload = {
        commit_message: commitMessage,
        conversation_context: JSON.parse(context),
      };
      await axios.post('https://chatcommit.fly.dev/commit/', payload);
      router.push('/');
    } catch (error) {
      console.error('Failed to submit commit:', error);
      alert('Commit failed. Check your context JSON.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Create a New Commit</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Commit Message</label>
          <input
            type="text"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            className="w-full mt-1 p-2 border rounded"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Conversation Context (JSON)</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={6}
            className="w-full mt-1 p-2 border rounded font-mono text-sm"
            required
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          {submitting ? 'Committing...' : 'Create Commit'}
        </button>
      </form>
    </div>
  );
}
