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
type Tag = ApiTag

export default function TimelinePage() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [branches, setBranches] = useState<Branch[]>([])
  const [tags, setTags] = useState<string[]>([])
  const [selectedBranch, setSelectedBranch] = useState<string>('')
  const [selectedTag, setSelectedTag] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        // all three return raw arrays
        const [timelineData, branchList, tagList] = await Promise.all([
          fetchTimeline(),
          fetchBranches(),
          fetchTags()
        ])

        setBranches(branchList)
        setTags(
          Array.from(new Set(tagList.map(t => t.name)))
            .sort()
        )

        const withTags = await Promise.all(
          timelineData.map(async c => {
            const ct = await fetchCommitTags(c.id)
            return { ...c, tags: ct.map(t => t.name) }
          })
        )
        setCommits(withTags)
      } catch (err: any) {
        console.error(err)
        setError(err.message || 'Failed to load timeline data.')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const filtered = commits.filter(c => {
    const okBranch = selectedBranch ? c.branch_id === Number(selectedBranch) : true
    const okTag = selectedTag ? c.tags?.includes(selectedTag) : true
    return okBranch && okTag
  })

  return (
    <div className="max-w-5xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">🕒 Timeline View</h2>

      <div className="flex gap-4 mb-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Branch</label>
          <select
            className="bg-gray-800 text-white px-3 py-1 rounded"
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

        <div>
          <label className="block text-sm text-gray-400 mb-1">Tag</label>
          <select
            className="bg-gray-800 text-white px-3 py-1 rounded"
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
      </div>

      {loading ? (
        <p>Loading…</p>
      ) : error ? (
        <p className="text-red-500">{error}</p>
      ) : filtered.length > 0 ? (
        filtered.map(c => <CommitCard key={c.id} {...c} />)
      ) : (
        <p className="text-gray-400">No commits found.</p>
      )}
    </div>
  )
}
