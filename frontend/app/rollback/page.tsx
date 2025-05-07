// app/rollback/page.tsx

'use client'

import { useState } from 'react'
import { rollbackBranch, fetchBranches, fetchBranchCommits } from '@/lib/api'

export default function RollbackPage() {
  const [branches, setBranches] = useState<any[]>([])
  const [commits, setCommits] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null)
  const [selectedCommitId, setSelectedCommitId] = useState<number | null>(null)
  const [message, setMessage] = useState<string>('')

  async function loadBranches() {
    const b = await fetchBranches()
    setBranches(b)
  }

  async function loadCommits(branchId: number) {
    const c = await fetchBranchCommits(branchId)
    setCommits(c)
    setSelectedBranchId(branchId)
  }

  async function handleRollback() {
    if (selectedBranchId && selectedCommitId) {
      const res = await rollbackBranch(selectedBranchId, selectedCommitId)
      setMessage(res.message)
    }
  }

  return (
    <div className="p-6 text-white">
      <h1 className="text-xl font-bold mb-4">Rollback Branch</h1>
      <button
        className="bg-blue-700 text-white px-4 py-2 rounded"
        onClick={loadBranches}
      >
        Load Branches
      </button>

      <div className="mt-4">
        {branches.map(branch => (
          <div key={branch.id} className="mb-2">
            <button
              className="text-green-400 underline"
              onClick={() => loadCommits(branch.id)}
            >
              {branch.name} (ID: {branch.id})
            </button>
          </div>
        ))}
      </div>

      {commits.length > 0 && (
        <div className="mt-6">
          <h2 className="text-lg font-semibold">Select Commit to Roll Back To</h2>
          <ul className="list-disc ml-6 mt-2">
            {commits.map(commit => (
              <li key={commit.id}>
                <label>
                  <input
                    type="radio"
                    name="commit"
                    value={commit.id}
                    onChange={() => setSelectedCommitId(commit.id)}
                  />
                  <span className="ml-2">
                    {commit.commit_message} (ID: {commit.id})
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <button
            className="mt-4 bg-red-600 text-white px-4 py-2 rounded"
            onClick={handleRollback}
          >
            Confirm Rollback
          </button>
        </div>
      )}

      {message && <p className="mt-6 text-yellow-400">{message}</p>}
    </div>
  )
}

