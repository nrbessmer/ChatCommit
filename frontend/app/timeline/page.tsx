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
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Pull timeline + pick‑lists whenever any filter changes
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      setError('');
      try {
        // fetch branches & tags for the dropdowns
        const [brRes, tgRes] = await Promise.all([fetchBranches(), fetchTags()]);
        const branchList = brRes.data as Branch[];
        const tagList = tgRes.data as { name: string }[];

        setBranches(branchList);
        setTags(Array.from(new Set(tagList.map(t => t.name))).sort());

        // build params for timeline endpoint
        const params: Record<string, any> = {};
        if (selectedBranch) params.branch_id = Number(selectedBranch);
        if (selectedTag)    params.tag       = selectedTag;
        if (startDate)      params.start_date = startDate;
        if (endDate)        params.end_date   = endDate;

        const tlRes = await fetchTimeline(params);
        const timelineList = tlRes.data as Commit[];

        // fetch tags per commit
        const commitsWithTags = await Promise.all(
          timelineList.map(async (c) => {
            try {
              const ct = await fetchCommitTags(c.id);
              return { ...c, tags: (ct.data as { name: string }[]).map(t => t.name) };
            } catch {
              return { ...c, tags: [] };
            }
          })
        );

        setCommits(commitsWithTags);
      } catch (err: any) {
        console.error('❌ Timeline load error:', err);
        setError(err.message || 'Failed to load timeline');
      } finally {
        setLoading(false);
      }
    };

    loadAll();
  }, [selectedBranch, selectedTag, startDate, endDate]);

  // apply branch/tag/date filters client‑side (though timeline API already did most)
  const visible = commits.filter((c) => {
    const byBranch = selectedBranch ? c.branch_id === Number(selectedBranch) : true;
    const byTag    = selectedTag  ? c.tags?.includes(selectedTag) : true;
    return byBranch && byTag;
  });

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">🕒 Timeline View</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Branch</label>
          <select
            className="bg-gray-800 text-white px-3 py-1 rounded"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
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
            className="bg-gray-800 text-white px-3 py-1 rounded"
            value={selectedTag}
            onChange={(e) => setSelectedTag(e.target.value)}
          >
            <option value="">All</option>
            {tags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">Start Date</label>
          <input
            type="date"
            className="bg-gray-800 text-white px-3 py-1 rounded"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </div>

        <div>
          <label className="block text-sm text-gray-400 mb-1">End Date</label>
          <input
            type="date"
            className="bg-gray-800 text-white px-3 py-1 rounded"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : visible.length > 0 ? (
        visible.map((c) => <CommitCard key={c.id} {...c} />)
      ) : (
        <p className="text-gray-400">No commits match those filters.</p>
      )}
    </div>
  );
}
