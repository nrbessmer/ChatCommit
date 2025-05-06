'use client';

import { useEffect, useState } from 'react';
import { fetchBranches, fetchTags, fetchTimeline, fetchCommitTags } from '@/lib/api';
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadAll() {
      setLoading(true);
      try {
        // 1) Fetch timeline, branches, tags in parallel
        const [tlResp, brResp, tgResp] = await Promise.all([
          fetchTimeline(),
          fetchBranches(),
          fetchTags(),
        ]);

        const timelineData = tlResp.data;
        const branchList   = brResp.data;
        const tagList      = tgResp.data;

        setBranches(branchList);
        setTags([...new Set(tagList.map(t => t.name))].sort());

        // 2) For each commit, fetch its tags
        const withTags = await Promise.all(
          timelineData.map(async (c) => {
            try {
              const resp = await fetchCommitTags(c.id);
              return { ...c, tags: resp.data.map(t => t.name) };
            } catch {
              return { ...c, tags: [] };
            }
          })
        );

        setCommits(withTags);
      } catch (e: any) {
        console.error('❌ Timeline load failed', e);
        setError(e.message || 'Failed to load timeline data');
      } finally {
        setLoading(false);
      }
    }

    loadAll();
  }, []);

  const filtered = commits.filter((c) => {
    const byBranch = selectedBranch ? c.branch_id === +selectedBranch : true;
    const byTag    = selectedTag    ? c.tags?.includes(selectedTag) : true;
    return byBranch && byTag;
  });

  if (loading) return <p>Loading…</p>;
  if (error)   return <p className="text-red-500">{error}</p>;

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">🕒 Timeline View</h2>

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
              <option key={b.id} value={b.id}>{b.name}</option>
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
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length > 0
        ? filtered.map((c) => <CommitCard key={c.id} {...c} />)
        : <p className="text-gray-400">No commits found.</p>
      }
    </div>
  );
}
