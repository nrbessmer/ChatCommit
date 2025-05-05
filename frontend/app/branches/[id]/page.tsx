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
  tags?: string[];       // we'll fill this in
}

interface Branch {
  id: number;
  name: string;
  current_commit_id: number | null;
}

export default function BranchDetailPage() {
  const { id } = useParams() as { id: string };
  const branchId = parseInt(id, 10);

  const [branch, setBranch] = useState<Branch | null>(null);
  const [commits, setCommits] = useState<Commit[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!branchId) return;
    setLoading(true);
    setError('');

    // 1) fetch branch & commits
    Promise.all([
      axios.get<Branch>(`/api/branch/${branchId}`),
      axios.get<Commit[]>(`/api/branch/${branchId}/commits`),
      axios.get<{ id: number; name: string }[]>(`/api/tag/branch/${branchId}`)
    ])
      .then(([bRes, cRes, tRes]) => {
        setBranch(bRes.data);

        // extract tag names
        const tags = Array.from(new Set(tRes.data.map(t => t.name)));
        setAllTags(tags);

        // now for each commit fetch its tags
        return Promise.all(
          cRes.data.map(async (c) => {
            const tagList = await axios
              .get<{ name: string }[]>(`/api/tag/commit/${c.id}`);
            return {
              ...c,
              tags: tagList.data.map(t => t.name),
            };
          })
        );
      })
      .then(fullCommits => {
        setCommits(fullCommits);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load branch or tags.');
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return <p className="p-6 text-white">Loading…</p>;
  if (error)   return <p className="p-6 text-red-500">{error}</p>;
  if (!branch) return <p className="p-6 text-white">Branch not found.</p>;

  // filter commits by selectedTag
  const visibleCommits = selectedTag
    ? commits.filter(c => c.tags?.includes(selectedTag))
    : commits;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-2">Branch: {branch.name}</h2>
      <p className="text-sm text-gray-400 mb-4">
        HEAD Commit ID: {branch.current_commit_id ?? 'None'}
      </p>

      {/* Tag‐filter dropdown */}
      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-1">Filter by tag:</label>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="bg-gray-800 text-white px-3 py-1 rounded"
        >
          <option value="">— All tags —</option>
          {allTags.map(tag => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>
      </div>

      {/* Commits */}
      {visibleCommits.length > 0 ? (
        visibleCommits.map(c => (
          <CommitCard key={c.id} {...c} />
        ))
      ) : (
        <p className="text-gray-400">
          {selectedTag
            ? `No commits with tag “${selectedTag}.”`
            : 'No commits found.'}
        </p>
      )}
    </div>
  );
}
