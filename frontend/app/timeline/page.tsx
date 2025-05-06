// app/timeline/page.tsx
'use client';

import { useEffect, useState } from 'react';
import CommitCard from '@/components/CommitCard';
import {
  fetchTimeline,
  fetchBranches,
  fetchTags,
  fetchCommitTags,
} from '@/lib/api';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
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
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    async function loadData() {
      try {
        // fetch raw lists
        const [tlRes, brRes, tgRes] = await Promise.all([
          fetchTimeline(),
          fetchBranches(),
          fetchTags(),
        ]);

        // extract data arrays
        const timelineData = tlRes.data;
        const branchList = brRes.data;
        const tagList = tgRes.data;

        // set branches
        setBranches(branchList);

        // unique tag names
        const allTagNames = Array.from(new Set(tagList.map((t) => t.name))).sort();
        setTags(allTagNames);

        // attach tags to each commit
        const commitsWithTags: Commit[] = await Promise.all(
          timelineData.map(async (c) => {
            try {
              const ct = await fetchCommitTags(c.id);
              return { ...c, tags: ct.data.map((t) => t.name) };
            } catch {
              return { ...c, tags: [] };
            }
          })
        );

        setCommits(commitsWithTags);
      } catch (e: any) {
        console.error('❌ Timeline load error:', e);
        setError('Failed to load timeline data.');
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // filter logic
  const visible = commits.filter((c) => {
    const byBranch = selectedBranch ? c.branch_id === Number(selectedBranch) : true;
    const byTag = selectedTag ? c.tags?.includes(selectedTag) : true;
    return byBranch && byTag;
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
            {tags.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : visible.length > 0 ? (
        visible.map((commit) => (
          <CommitCard
            key={commit.id}
            id={commit.id}
            commit_hash={commit.commit_hash}
            commit_message={commit.commit_message}
            created_at={commit.created_at}
            tags={commit.tags}
          />
        ))
      ) : (
        <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  );
}
