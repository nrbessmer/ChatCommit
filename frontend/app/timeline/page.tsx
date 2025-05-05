'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import CommitCard from '@/components/CommitCard';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id: number;
  tags?: string[];
}

interface Branch {
  id: number;
  name: string;
}

export default function TimelinePage() {
  const [commits, setCommits] = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedTag, setSelectedTag] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [commitRes, branchRes, tagRes] = await Promise.all([
          api.get<Commit[]>('/timeline'),
          api.get<Branch[]>('/branch'),
          api.get<{ name: string }[]>('/tag'),
        ]);

        setBranches(branchRes.data);
        setTags([...new Set(tagRes.data.map((t) => t.name))]);

        const commitsWithTags = await Promise.all(
          commitRes.data.map(async (commit) => {
            const tagData = await api.get<{ name: string }[]>(
              `/tag/commit/${commit.id}`,
            );
            return {
              ...commit,
              tags: tagData.data.map((t) => t.name),
            };
          }),
        );

        setCommits(commitsWithTags);
      } catch (err) {
        console.error(err);
        setError('Failed to load timeline data.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const filtered = commits.filter((commit) => {
    const branchMatch = selectedBranch
      ? commit.branch_id === Number(selectedBranch)
      : true;
    const tagMatch = selectedTag
      ? commit.tags?.includes(selectedTag)
      : true;
    return branchMatch && tagMatch;
  });

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">🕒 Timeline View</h2>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Branch</label>
          <select
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
            className="bg-gray-800 text-white px-3 py-1 rounded"
          >
            <option value="">All</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Tag</label>
          <select
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
            className="bg-gray-800 text-white px-3 py-1 rounded"
          >
            <option value="">All</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : filtered.length > 0 ? (
        filtered.map((commit) => <CommitCard key={commit.id} {...commit} />)
      ) : (
        <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  );
}

