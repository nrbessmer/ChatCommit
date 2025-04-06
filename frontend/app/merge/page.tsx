'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Branch {
  id: number;
  name: string;
}

async function retry<T>(fn: () => Promise<T>, retries = 3, delay = 500): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (retries <= 0) throw err;
    await new Promise(r => setTimeout(r, delay));
    return retry(fn, retries - 1, delay);
  }
}

export default function MergePage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [targetId, setTargetId] = useState('');
  const [status, setStatus] = useState('');
  const [loadingBranches, setLoadingBranches] = useState(true);
  const [errorBranches, setErrorBranches] = useState('');

  useEffect(() => {
    retry(() => axios.get<Branch[]>('https://chatcommit.fly.dev/branch/'))
      .then(res => setBranches(res.data))
      .catch(err => {
        console.error('Error loading branches:', err);
        setErrorBranches('Failed to load branches.');
      })
      .finally(() => setLoadingBranches(false));
  }, []);

  const handleMerge = async () => {
    if (!sourceId || !targetId || sourceId === targetId) {
      setStatus('Please select two different branches.');
      return;
    }
    setStatus('Merging...');
    try {
      const res = await retry(() => axios.post(
        `https://chatcommit.fly.dev/merge/${sourceId}/${targetId}`
      ));
      setStatus(res.data.message);
    } catch (err: any) {
      console.error('Merge failed:', err);
      setStatus(err.response?.data?.detail || 'Merge failed.');
    }
  };

  if (loadingBranches) return <p className="p-6 text-white">Loading branches...</p>;
  if (errorBranches) return <p className="p-6 text-red-500">{errorBranches}</p>;

  return (
    <div className="max-w-xl mx-auto p-6 text-white">
      <h2 className="text-xl font-bold mb-4">Merge Branches</h2>
      <div className="mb-4">
        <label className="block mb-1">Source Branch</label>
        <select
          value={sourceId}
          onChange={e => setSourceId(e.target.value)}
          className="w-full p-2 border rounded bg-gray-800 text-gray-100"
        >
          <option value="">Select source</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </div>
      <div className="mb-4">
        <label className="block mb-1">Target Branch</label>
        <select
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
          className="w-full p-2 border rounded bg-gray-800 text-gray-100"
        >
          <option value="">Select target</option>
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
      {status && <div className="mt-4 p-3 bg-gray-700 text-white rounded">{status}</div>}
    </div>
  );
}
