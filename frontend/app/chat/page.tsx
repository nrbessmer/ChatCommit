'use client';

import { useState } from 'react';
import axios from 'axios';

export default function ChatPage() {
  const [prompt, setPrompt] = useState('');
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!prompt.trim()) {
      alert('Please enter a prompt.');
      return;
    }

    setLoading(true);
    setResponse('');

    try {
      const res = await axios.post('https://chatcommit.fly.dev:8000/commit/ask', { prompt });
      setResponse(res.data.response);
    } catch (err: any) {
      setResponse(`Error: ${err.response?.data?.detail || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">Ask ChatGPT via ChatCommit</h2>

      <div className="mb-4">
        <label className="block font-medium text-sm">Prompt</label>
        <textarea
          rows={4}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="w-full p-2 border rounded mt-1"
          placeholder="Ask a question..."
        />
      </div>

      <button
        onClick={handleAsk}
        disabled={loading}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        {loading ? 'Asking...' : 'Ask GPT'}
      </button>

      {response && (
        <div className="mt-6 p-4 border bg-gray-100 rounded whitespace-pre-wrap">
          <h3 className="font-semibold mb-2">Response:</h3>
          <div>{response}</div>
        </div>
      )}
    </div>
  );
}
