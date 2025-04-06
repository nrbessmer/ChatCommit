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
    axios.get<Branch[]>('https://chatcommit.fly.dev/branch/')
      .then(res => {
        console.log("Fetched branches:", res.data);
        setBranches(res.data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Failed to load branches:", err);
        setError("Failed to load branches.");
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-white">
        <p>Loading branches...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-white">
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  if (!branches || branches.length === 0) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-white">
        <p>No branches found.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-6">Branches</h2>
      {branches.map(branch => (
        <div key={branch.id} className="bg-gray-800 rounded-lg p-4 mb-4 shadow">
          <p className="text-green-400 font-bold text-lg">
            {branch.name} <span className="text-sm text-gray-400">(#{branch.id})</span>
          </p>
          <p className="text-sm text-gray-300 mt-1">
            HEAD Commit ID: {branch.current_commit_id ?? 'None'}
          </p>
          <Link
            href={`/branches/${branch.id}`}
            className="text-blue-400 text-sm hover:underline mt-2 inline-block"
          >
            View Commits →
          </Link>
        </div>
      ))}
    </div>
  );
}

