// frontend/app/timeline/page.tsx
'use client'

import { useEffect, useState } from 'react'
import CommitCard from '@/components/CommitCard'
import {
  fetchTimeline,
  fetchBranches,
  fetchTags,
  fetchCommitTags,
  Commit as ApiCommit,
  Branch as ApiBranch,
  Tag as ApiTag
} from '@/lib/api'

type Commit = ApiCommit & { tags?: string[] }
type Branch = ApiBranch

export default function TimelinePage() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [startDate, setStartDate] = useState<string>('')   // YYYY‑MM‑DD
  const [endDate, setEndDate] = useState<string>('')       // YYYY‑MM‑DD
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  // whenever any filter changes, re‑fetch
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        // build params object
        const params: Record<string, any> = {}
        if (selectedBranch) params.branch_id = Number(selectedBranch)
        if (selectedTag)    params.tag       = selectedTag
        if (startDate)      params.start_date = `${startDate}T00:00:00`
        if (endDate)        params.end_date   = `${endDate}T23:59:59`

        // fetch raw timeline, branch list, tag list in parallel
        const [tlData, brList, tgList] = await Promise.all([
          fetchTimeline(params),
          fetchBranches(),
          fetchTags()
        ])

        setBranches(brList)
        setTags(Array.from(new Set(tgList.map(t => t.name))).sort())

        // attach tags per commit
        const withTags = await Promise.all(
          tlData.map(async c => {
            const ct = await fetchCommitTags(c.id)
            return { ...c, tags: ct.map(t => t.name) }
          })
        )
        setCommits(withTags)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Failed to load timeline')
      } finally {
        setLoading(false)
      }
    }
    load()
  },
  // dependencies: re‐run whenever a filter changes
  [ selectedBranch, selectedTag, startDate, endDate ] )

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">🕒 Timeline View</h2>

      {/* ─── Filters ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {/* Branch */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Branch</label>
          <select
            className="bg-gray-800 text-white px-3 py-1 rounded w-full"
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
          >
            <option value="">All</option>
            {branches.map(b => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>

        {/* Tag */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Tag</label>
          <select
            className="bg-gray-800 text-white px-3 py-1 rounded w-full"
            value={selectedTag}
            onChange={e => setSelectedTag(e.target.value)}
          >
            <option value="">All</option>
            {tags.map(tag => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>

        {/* Start Date */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Date From</label>
          <input
            type="date"
            className="bg-gray-800 text-white px-3 py-1 rounded w-full"
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
          />
        </div>

        {/* End Date */}
        <div>
          <label className="block text-sm text-gray-400 mb-1">Date To</label>
          <input
            type="date"
            className="bg-gray-800 text-white px-3 py-1 rounded w-full"
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* ─── Timeline List ─────────────────────────────────── */}
      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : commits.length > 0 ? (
        commits.map(c => <CommitCard key={c.id} {...c} />)
      ) : (
        <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  )
}
