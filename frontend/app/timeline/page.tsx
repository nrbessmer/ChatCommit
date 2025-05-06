'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import CommitCard from '@/components/CommitCard';

/* ------------------------------------------------------------------ */
/* Types                                                               */
/* ------------------------------------------------------------------ */
interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id: number;
  tags?: string[];
}

interface Branch  { id: number; name: string }
interface Tag     { id: number; name: string }   // <── NEW helper type

export default function TimelinePage() {
  const [commits,  setCommits]  = useState<Commit[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [tags,     setTags]     = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [selectedTag,    setSelectedTag]    = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(true);

  /* ---------------------------------------------------------------- */
  /* Fetch everything in parallel                                      */
  /* ---------------------------------------------------------------- */
  useEffect(() => {
    const fetchData = async () => {
      console.log('🌐 Fetching timeline, branches, and tags …');

      try {
        /*                ────────────  NOTE the type arguments  ─────────── */
        const [commitRes, branchRes, tagRes] = await Promise.all([
          api.get<Commit[]>('/timeline'),
          api.get<Branch[]>('/branch/'),    // ← trailing “/” avoids 307
          api.get<Tag[]>('/tag/'),
        ]);

        /* Dropdown lists -------------------------------------------------- */
        setBranches(branchRes.data);
        setTags(
          Array.from(new Set(tagRes.data.map(t => t.name))).sort()
        );

        /* Attach tags to every commit (also in parallel) ------------------ */
        const commitsWithTags = await Promise.all(
          commitRes.data.map(async (c) => {
            const { data } = await api.get<Tag[]>(`/tag/commit/${c.id}`);
            return { ...c, tags: data.map(t => t.name) };
          })
        );

        setCommits(commitsWithTags);
      } catch (e: any) {
        console.error('❌ Timeline fetch error:', e);
        setError(
          `Failed to load timeline data: ${e.message ?? JSON.stringify(e)}`
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  /* ---------------------------------------------------------------- */
  /* Filter helpers                                                   */
  /* ---------------------------------------------------------------- */
  const visible = commits.filter(c =>
    (selectedBranch ? c.branch_id === +selectedBranch : true) &&
    (selectedTag    ? c.tags?.includes(selectedTag) : true)
  );

  /* ---------------------------------------------------------------- */
  /* UI                                                               */
  /* ---------------------------------------------------------------- */
  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">🕒 Timeline View</h2>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        {/* Branch filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Branch</label>
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="bg-gray-800 text-white px-3 py-1 rounded"
          >
            <option value="">All</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        {/* Tag filter */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tag</label>
          <select
            value={selectedTag}
            onChange={e => setSelectedTag(e.target.value)}
            className="bg-gray-800 text-white px-3 py-1 rounded"
          >
            <option value="">All</option>
            {tags.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Results */}
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : visible.length ? (
        visible.map(c => <CommitCard key={c.id} {...c} />)
      ) : (
        <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  );
}
