'use client';

import React, { useState } from 'react';
import axios from 'axios';

interface TagFormProps {
  commitId: number;
  onCreated?: () => void;
}

export default function TagForm({ commitId, onCreated }: TagFormProps) {
  const [tagName, setTagName] = useState('');
  const [status, setStatus] = useState('');

  const handleAddTag = async () => {
    if (!tagName.trim()) {
      setStatus('❌ Tag name cannot be empty');
      return;
    }
    try {
      const res = await axios.post('https://chatcommit.fly.dev/tag/', {
        name: tagName,
        commit_id: commitId,
      });
      setStatus(`✅ Tag "${res.data.name}" created`);
      setTagName('');

      // If a parent callback is provided, call it
      if (onCreated) {
        onCreated();
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Error creating tag';
      setStatus(`❌ ${detail}`);
    }
  };

  return (
    <div className="p-3 mb-3 rounded bg-gray-900 text-gray-100 border border-gray-700">
      <h3 className="text-sm font-bold mb-2">Add Tag</h3>

      <div className="flex gap-2 items-center">
        <input
          type="text"
          className="bg-gray-800 text-gray-100 border border-gray-600 rounded w-48 text-sm px-2 py-1"
          placeholder='e.g. "chatgpt"'
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
        />
        <button
          onClick={handleAddTag}
          className="bg-green-600 text-white text-sm px-3 py-1 rounded hover:bg-green-700"
        >
          Add Tag
        </button>
      </div>

      {status && (
        <p className="text-xs mt-1 text-gray-300">
          {status}
        </p>
      )}
    </div>
  );
}
