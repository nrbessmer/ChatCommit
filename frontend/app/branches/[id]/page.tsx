// File: app/branches/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import CommitCard from '@/components/CommitCard';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  tags?: string[];
}

interface Branch {
  id: number;
  name: string;
  current_commit_id: number | null;
}

export default function BranchDetailPage() {
  const { id } = useParams() as { id: string };
  const branchId = Number(id);

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

    const fetchTagsForCommit = async (commitId: number) => {
      try {
        const { data } = await api.get<{ name: string }[]>(`/tag/commit/${commitId}`);
        return data.map((t) => t.name);
      } catch (err) {
        console.error(`Failed to fetch tags for commit ${commitId}`, err);
        return [];
      }
    };

    Promise.all([
      api.get<Branch>(`/branch/${branchId}`),
      api.get<Commit[]>(`/branch/${branchId}/commits`),
      api.get<{ id: number; name: string }[]>(`/tag/branch/${branchId}`),
    ])
      .then(async ([bRes, cRes, tRes]) => {
        setBranch(bRes.data);

        const tags = Array.from(new Set(tRes.data.map((t) => t.name))).sort();
        setAllTags(tags);

        const commitsWithTags = await Promise.all(
          cRes.data.map(async (c) => ({
            ...c,
            tags: await fetchTagsForCommit(c.id),
          })),
        );
        setCommits(commitsWithTags);
      })
      .catch((e) => {
        console.error(e);
        setError('Failed to load branch or commits.');
      })
      .finally(() => setLoading(false));
  }, [branchId]);

  if (loading) return <p className="p-6 text-white">Loading…</p>;
  if (error) return <p className="p-6 text-red-500">{error}</p>;
  if (!branch) return <p className="p-6 text-white">Branch not found.</p>;

  const visibleCommits = selectedTag
    ? commits.filter((c) => c.tags?.includes(selectedTag))
    : commits;

  return (
    <div className="max-w-4xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-2">
        Branch: {branch.name} ({commits.length} commits)
      </h2>
      <p className="text-sm text-gray-400 mb-4">
        HEAD Commit ID: {branch.current_commit_id ?? 'None'}
      </p>

      <div className="mb-4">
        <label className="block text-sm text-gray-300 mb-1">Filter by tag:</label>
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="bg-gray-800 text-white px-3 py-1 rounded"
        >
          <option value="">— All tags —</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>
              {tag}
            </option>
          ))}
        </select>
      </div>

      {visibleCommits.length > 0 ? (
        visibleCommits.map((c) => <CommitCard key={c.id} {...c} />)
      ) : (
        <p className="text-gray-400">
          {selectedTag
            ? `No commits with tag “${selectedTag}”.`
            : 'No commits found.'}
        </p>
      )}
    </div>
  );
}
