'use client';

import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, retries - 1, delay);
  }
}

export default function CommitForm({ branchId }: { branchId: number }) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [context, setContext] = useState('');
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setStatus('Committing...');
    let parsedContext = {};
    try {
      parsedContext = JSON.parse(context || '{}');
    } catch {
      setStatus('Invalid JSON context.');
      setSubmitting(false);
      return;
    }

    try {
      const res = await retry(() =>
        axios.post('https://chatcommit.fly.dev/commit/', {
          commit_message: message,
          conversation_context: parsedContext,
          branch_id: branchId,
        })
      );
      setStatus(`✅ Commit created: ${res.data.commit_hash}`);
      setMessage('');
      setContext('');
      // Optionally redirect or refresh
      router.refresh();
    } catch (err: any) {
      console.error('Commit failed:', err);
      setStatus(err.response?.data?.detail || 'Error creating commit.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-xl mx-auto p-4 bg-gray-800 text-white rounded">
      <h3 className="text-lg font-bold mb-2">New Commit on Branch #{branchId}</h3>
      <input
        type="text"
        value={message}
        onChange={e => setMessage(e.target.value)}
        placeholder="Commit message"
        className="w-full mb-2 p-2 bg-gray-700 rounded"
        required
      />
      <textarea
        value={context}
        onChange={e => setContext(e.target.value)}
        rows={4}
        placeholder='Conversation context JSON'
        className="w-full mb-2 p-2 bg-gray-700 rounded font-mono text-sm"
        required
      />
      <button
        type="submit"
        disabled={submitting}
        className="bg-green-600 px-4 py-2 rounded hover:bg-green-700"
      >
        {submitting ? 'Committing...' : 'Create Commit'}
      </button>
      {status && <p className="mt-2 text-sm">{status}</p>}
    </form>
  );
}
