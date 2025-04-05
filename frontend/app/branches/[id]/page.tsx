'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import axios from 'axios';
import CommitCard from '@/components/CommitCard';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
}

interface Branch {
  id: number;
  name: string;
  current_commit_id: number | null;
}

export default function BranchDetailPage() {
  const params = useParams() as { id: string };
  const branchId = params.id;

  const [branch, setBranch] = useState<Branch | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);

  useEffect(() => {
    if (!branchId) return;

    axios.get<Branch>(`https://chatcommit.fly.dev/api//branch/${branchId}`)
      .then(res => setBranch(res.data))
      .catch(console.error);

    axios.get<Commit[]>(`https://chatcommit.fly.dev/api//branch/${branchId}/commits`)
      .then(res => setCommits(res.data))
      .catch(console.error);
  }, [branchId]);

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Commits</h2>

      {branch && (
        <div className="mb-6 bg-gray-800 p-4 rounded shadow">
          <p className="text-green-400 font-bold text-lg">{branch.name}</p>
          <p className="text-sm text-gray-400">
            HEAD Commit ID: {branch.current_commit_id ?? 'None'}
          </p>
        </div>
      )}

      {commits.length > 0 ? (
        commits.map(commit => <CommitCard key={commit.id} {...commit} />)
      ) : (
        <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  );
}
