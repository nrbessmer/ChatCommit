'use client';

import { useEffect, useState } from 'react';
import { api, fetchTimeline, fetchBranches, fetchTags, fetchCommitTags } from '@/lib/api';
import CommitCard from '@/components/CommitCard';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id: number;
  tags?: string[];
}
interface Branch { id: number; name: string; }

export default function TimelinePage() {
  const [commits,   setCommits]   = useState<Commit[]>([]);
  const [branches,  setBranches]  = useState<Branch[]>([]);
  const [tags,      setTags]      = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedTag,    setSelectedTag]    = useState('');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    (async () => {
      console.log('🌐 loading timeline…');
      try {
        /* ------- parallel fetches (each returns a .data object) ------- */
        const [{ data: timeline },
               { data: branchList },
               { data: tagList }] = await Promise.all([
          fetchTimeline(),          // GET  /timeline
          fetchBranches(),          // GET  /branch/
          fetchTags(),              // GET  /tag/
        ]);

        /* build branch & global‑tag pick‑lists */
        setBranches(branchList);
        setTags(Array.from(new Set(tagList.map(t => t.name))).sort());

        /* attach tags to every commit (done in parallel too) */
        const commitsWithTags = await Promise.all(
          timeline.map(async c => {
            try {
              const { data } = await fetchCommitTags(c.id); // GET /tag/commit/{id}
              return { ...c, tags: data.map(t => t.name) };
            } catch (e) {
              console.warn('tag fetch failed for commit', c.id, e);
              return { ...c, tags: [] };
            }
          })
        );
        setCommits(commitsWithTags);
      } catch (e: any) {
        console.error('❌ timeline load', e);
        setError(e.message ?? 'Unknown error loading timeline');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ---- client‑side filtering ---- */
  const visible = commits.filter(c =>
    (selectedBranch ? c.branch_id === Number(selectedBranch) : true) &&
    (selectedTag    ? c.tags?.includes(selectedTag)          : true)
  );

  /* ---- UI ---- */
  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">🕒 Timeline View</h2>

      {/* filters */}
      <div className="flex gap-4 mb-6">
        {/* branch filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Branch</label>
          <select value={selectedBranch} onChange={e => setSelectedBranch(e.target.value)}
                  className="bg-gray-800 text-white px-3 py-1 rounded">
            <option value="">All</option>
            {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </div>

        {/* tag filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tag</label>
          <select value={selectedTag} onChange={e => setSelectedTag(e.target.value)}
                  className="bg-gray-800 text-white px-3 py-1 rounded">
            <option value="">All</option>
            {tags.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* data state */}
      {loading && <p>Loading…</p>}
      {error   && <p className="text-red-500">{error}</p>}
      {!loading && !error && (
        visible.length
          ? visible.map(c => <CommitCard key={c.id} {...c} />)
          : <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  );
}
