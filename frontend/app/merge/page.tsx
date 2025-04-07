'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Branch {
  id: number;
  name: string;
}

export default function MergePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sourceBranch, setSourceBranch] = useState('');
  const [targetBranch, setTargetBranch] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    axios.get<Branch[]>('https://chatcommit.fly.dev/branch/')
      .then(res => setBranches(res.data))
      .catch(err => {
        console.error('Error loading branches:', err);
        setError('Failed to load branches.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleMerge = async () => {
    if (!sourceBranch || !targetBranch || sourceBranch === targetBranch) {
      alert('Please select two different branches.');
      return;
    }
    setMessage('Merging...');
    try {
      const res = await axios.post('https://chatcommit.fly.dev/merge', {
        source_branch_id: parseInt(sourceBranch),
        target_branch_id: parseInt(targetBranch)
      });
      setMessage(res.data.message);
    } catch (err: any) {
      console.error('Merge failed:', err);
      setMessage(err.response?.data?.detail || 'Merge failed.');
    }
  };

  if (loading) return <p className="p-6 text-white">Loading branches…</p>;
  if (error) return <p className="p-6 text-red-500">{error}</p>;

  return (
    <div className="max-w-xl mx-auto p-6 text-white bg-gray-900 rounded-lg">
      <h2 className="text-xl font-bold mb-4">Merge Branches</h2>
      <div className="mb-4">
        <label className="block mb-1">Source Branch</label>
        <select
          value={sourceBranch}
          onChange={e => setSourceBranch(e.target.value)}
          className="w-full p-2 border rounded bg-gray-800 text-gray-100"
        >
          <option value="">Select source branch</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1">Target Branch</label>
        <select
          value={targetBranch}
          onChange={e => setTargetBranch(e.target.value)}
          className="w-full p-2 border rounded bg-gray-800 text-gray-100"
        >
          <option value="">Select target branch</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <button
        onClick={handleMerge}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Merge
      </button>
      {message && <div className="mt-4 p-3 bg-gray-700 rounded text-sm">{message}</div>}
    </div>
  );
}
