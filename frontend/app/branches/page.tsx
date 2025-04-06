'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

interface Branch {
  id: number;
  name: string;
  current_commit_id: number | null;
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    axios
      .get<Branch[]>('/api/branch/')        // <- proxied endpoint
      .then(res => setBranches(res.data))
      .catch(err => setError("Failed to load branches."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="p-6 text-white">Loading branches…</p>;
  if (error)   return <p className="p-6 text-red-500">{error}</p>;
  if (branches.length === 0)
    return <p className="p-6 text-white">No branches found.</p>;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-6">Branches</h2>
      {branches.map(b => (
        <div key={b.id} className="bg-gray-800 rounded-lg p-4 mb-4 shadow">
          <p className="text-green-400 font-bold text-lg">
            {b.name} <span className="text-sm text-gray-400">(#{b.id})</span>
          </p>
          <p className="text-sm text-gray-300 mt-1">
            HEAD Commit ID: {b.current_commit_id ?? 'None'}
          </p>
          <Link href={`/branches/${b.id}`} className="text-blue-400 hover:underline">
            View Commits →
          </Link>
        </div>
      ))}
    </div>
  );
}
