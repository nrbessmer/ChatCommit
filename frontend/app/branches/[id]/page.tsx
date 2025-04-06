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
  console.log("BranchDetailPage: branchId from URL:", branchId);

  const [branch, setBranch] = useState<Branch | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!branchId) return;

    // Fetch branch details
    axios
      .get<Branch>(`https://chatcommit.fly.dev/branch/${branchId}`)
      .then((res) => {
        console.log("Branch data:", res.data);
        setBranch(res.data);
      })
      .catch((err) => {
        console.error("Error fetching branch:", err);
        setError("Error fetching branch data.");
      });

    // Fetch commits for the branch
    axios
      .get<Commit[]>(`https://chatcommit.fly.dev/branch/${branchId}/commits`)
      .then((res) => {
        console.log("Commits data:", res.data);
        setCommits(res.data);
      })
      .catch((err) => {
        console.error("Error fetching commits:", err);
        setError("Error fetching commits data.");
      });
  }, [branchId]);

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">Commits</h2>

      {error && <p className="text-red-500 mb-4">{error}</p>}

      {branch ? (
        <div className="mb-6 bg-gray-800 p-4 rounded shadow">
          <p className="text-green-400 font-bold text-lg">{branch.name}</p>
          <p className="text-sm text-gray-400">
            HEAD Commit ID: {branch.current_commit_id ?? 'None'}
          </p>
        </div>
      ) : (
        <p className="text-gray-400">Loading branch info...</p>
      )}

      {commits.length > 0 ? (
        commits.map((commit) => <CommitCard key={commit.id} {...commit} />)
      ) : (
        <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  );
}
