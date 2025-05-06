// frontend/app/page.tsx
'use client'

import { useEffect, useState } from 'react'
import CommitCard from '@/components/CommitCard'
import { fetchBranchCommits, Commit as ApiCommit } from '@/lib/api'

type Commit = ApiCommit

export default function HomePage() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [error, setError] = useState<string>('')
  const [loading, setLoading] = useState<boolean>(false)
  const [activeBranchId, setActiveBranchId] = useState<number | null>(null)

  // load last‐used branch
  useEffect(() => {
    const stored = window.localStorage.getItem('activeBranchId')
    if (stored) setActiveBranchId(Number(stored))
  }, [])

  // fetch commits whenever branch changes
  useEffect(() => {
    if (activeBranchId !== null) {
      setLoading(true)
      fetchBranchCommits(activeBranchId)
        .then(data => {
          setCommits(data)
        })
        .catch(err => {
          console.error(err)
          setError('Failed to load commits.')
        })
        .finally(() => setLoading(false))
    }
  }, [activeBranchId])

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-4">
        Commits for Branch {activeBranchId ?? '(none selected)'}
      </h2>

      {loading && <p className="text-gray-500">Loading…</p>}
      {error && <p className="text-red-500">{error}</p>}
      {!loading && commits.length === 0 && (
        <p className="text-gray-500">No commits found for this branch.</p>
      )}

      {commits.map(commit => (
        <CommitCard key={commit.id} {...commit} />
      ))}
    </div>
  )
}
