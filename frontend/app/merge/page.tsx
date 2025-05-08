// frontend/app/components/MergeBranchesForm.tsx
'use client'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE } from '@/lib/api'   // centralised base URL

/* ──────────────────────────────────────────────────────────
   Types
────────────────────────────────────────────────────────── */
export interface MergeFormProps {
  onMerged?: (message: string) => void   // optional callback
}

interface Branch {
  id: number
  name: string
}

/* ──────────────────────────────────────────────────────────
   Component
────────────────────────────────────────────────────────── */
export default function MergeBranchesForm({ onMerged }: MergeFormProps) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [sourceId, setSourceId] = useState('')
  const [targetId, setTargetId] = useState('')
  const [status,   setStatus]   = useState('')

  /* ── load branches once ──────────────────────────────── */
  useEffect(() => {
    axios
      .get<Branch[]>(`${API_BASE}/branch/`)
      .then(res => setBranches(res.data))
      .catch(err => console.error('Error loading branches:', err))
  }, [])

  /* ── merge action ────────────────────────────────────── */
  const handleMerge = async () => {
    if (!sourceId || !targetId || sourceId === targetId) {
      return alert('Please select two *different* branches.')
    }

    try {
      const token = localStorage.getItem('auth_token') || ''
      const res   = await axios.post(
        `${API_BASE}/merge/${sourceId}/${targetId}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStatus(res.data.message)
      onMerged?.(res.data.message)
    } catch (err: any) {
      const detail = err.response?.data?.detail || 'Merge failed'
      setStatus(`❌ ${detail}`)
    }
  }

  /* ── UI ──────────────────────────────────────────────── */
  return (
    <div className="p-4 bg-gray-900 text-gray-100 border border-gray-700 rounded">
      <h3 className="text-sm font-bold mb-3">Merge Branches</h3>

      <div className="flex flex-col gap-3 mb-3">
        {/* Source branch */}
        <select
          className="border border-gray-600 bg-gray-800 text-gray-100 p-2 rounded"
          value={sourceId}
          onChange={e => setSourceId(e.target.value)}
        >
          <option value="">-- Select source branch --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} (#{b.id})
            </option>
          ))}
        </select>

        {/* Target branch */}
        <select
          className="border border-gray-600 bg-gray-800 text-gray-100 p-2 rounded"
          value={targetId}
          onChange={e => setTargetId(e.target.value)}
        >
          <option value="">-- Select target branch --</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>
              {b.name} (#{b.id})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleMerge}
        className="bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700 text-sm"
      >
        Merge
      </button>

      {status && (
        <div className="mt-3 bg-blue-100 text-blue-800 p-2 rounded text-sm">
          {status}
        </div>
      )}
    </div>
  )
}
