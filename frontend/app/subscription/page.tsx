'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import CommitCard from '@/components/CommitCard'
import { fetchBranchCommits, ApiCommit } from '@/lib/api'

type Commit = ApiCommit

export default function Home() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadCommits() {
      try {
        const data = await fetchBranchCommits()
        setCommits(data)
      } catch (e) {
        setError('Failed to load commits')
        console.error('Error loading commits:', e)
      } finally {
        setLoading(false)
      }
    }

    loadCommits()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="text-red-500 text-xl">{error}</div>
      </div>
    )
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8 text-green-500">
        Recent Commits
      </h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {commits.map((commit) => (
          <CommitCard key={commit.id} commit={commit} />
        ))}
      </div>
    </main>
  )
}