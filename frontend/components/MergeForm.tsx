'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Branch {
  id: number;
  name: string;
}

interface MergeFormProps {
  onMerged?: (message: string) => void; // optional callback to handle success
}

export default function MergeForm({ onMerged }: MergeFormProps) {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    axios
      .get('https://chatcommit.fly.dev/branch/')
      .then((res) => setBranches(res.data))
      .catch((err) => console.error('Error loading branches:', err));
  }, []);

  const handleMerge = async () => {
    if (!sourceId || !targetId || sourceId === targetId) {
      return alert('Please select two different branches to merge.');
    }

    try {
      const res = await axios.post(
        `https://chatcommit.fly.dev/merge/${sourceId}/${targetId}`
      );
      setStatus(res.data.message);
      if (onMerged) {
        onMerged(res.data.message);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Merge failed';
      setStatus(`❌ ${detail}`);
    }
  };

  return (
    <div className="p-4 bg-gray-900 text-gray-100 border border-gray-700 rounded">
      <h3 className="text-sm font-bold mb-2">Merge Branches</h3>

      <div className="flex flex-col gap-3 mb-3">
        <select
          className="border border-gray-600 bg-gray-800 text-gray-100 p-2 rounded"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
        >
          <option value="">-- Select source branch --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} (#{b.id})
            </option>
          ))}
        </select>

        <select
          className="border border-gray-600 bg-gray-800 text-gray-100 p-2 rounded"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
        >
          <option value="">-- Select target branch --</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} (#{b.id})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleMerge}
        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
      >
        Merge
      </button>

      {status && (
        <div className="mt-3 bg-blue-100 text-blue-800 p-2 rounded text-sm">
          {status}
        </div>
      )}
    </div>
  );
}
