'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Branch {
  id: number;
  name: string;
}

export default function MergePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sourceBranch, setSourceBranch] = useState<string>('');
  const [targetBranch, setTargetBranch] = useState<string>('');
  const [message, setMessage] = useState<string>('');

  useEffect(() => {
    axios
      .get('https://chatcommit.fly.dev/branch/')
      .then((res) => setBranches(res.data))
      .catch((err) => console.error('Failed to load branches', err));
  }, []);

  const handleMerge = async () => {
    try {
      const res = await axios.post(
        `https://chatcommit.fly.dev:8000/merge`,
        {
          source_branch_id: parseInt(sourceBranch),
          target_branch_id: parseInt(targetBranch),
        }
      );
      setMessage(res.data.message);
    } catch (err: any) {
      setMessage(err.response?.data?.detail || 'Merge failed');
    }
  };

  return (
    <div className="max-w-xl mx-auto p-6">
      <h2 className="text-xl font-bold mb-4">Merge Branches</h2>

      <div className="mb-4">
        <label className="block mb-1">Source Branch</label>
        <select
          value={sourceBranch}
          onChange={(e) => setSourceBranch(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Select source</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-4">
        <label className="block mb-1">Target Branch</label>
        <select
          value={targetBranch}
          onChange={(e) => setTargetBranch(e.target.value)}
          className="w-full p-2 border rounded"
        >
          <option value="">Select target</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleMerge}
        disabled={!sourceBranch || !targetBranch}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Merge
      </button>

      {message && <div className="mt-4 p-3 bg-gray-100">{message}</div>}
    </div>
  );
}

