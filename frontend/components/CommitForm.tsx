'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface CommitFormProps {
  branchId: number;
  onCommitCreated?: () => void;
}

export default function CommitForm({ branchId, onCommitCreated }: CommitFormProps) {
  const [message, setMessage] = useState('');
  const [context, setContext] = useState('');
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    try {
      const parsedContext = JSON.parse(context || '{}');
      const res = await axios.post('https://chatcommit.fly.dev', {
        commit_message: message,
        conversation_context: parsedContext,
        branch_id: branchId,
      });

      setStatus(`✅ Commit created: ${res.data.commit_hash}`);
      setMessage('');
      setContext('');

      // after creation, let parent refresh commits
      if (onCommitCreated) {
        onCommitCreated();
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Error creating commit';
      setStatus(`❌ ${detail}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <h3 className="text-sm font-bold mb-1">Create Commit on Branch #{branchId}</h3>
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Commit message"
        className="bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-1 w-full"
      />
      <textarea
        rows={3}
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder='JSON context (e.g. {"messages": ["Hi", "Hello"]})'
        className="bg-gray-800 text-gray-100 border border-gray-700 rounded px-2 py-1 w-full"
      />
      <button
        type="submit"
        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
      >
        Commit
      </button>

      {status && <p className="text-xs mt-1 text-gray-300">{status}</p>}
    </form>
  );
}
