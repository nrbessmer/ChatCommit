/* components/MergeBranchesForm.tsx
   Completely self‑contained “merge branches” widget
-----------------------------------------------------------------*/
'use client'

import React, { useEffect, useState } from 'react'
import axios from 'axios'
import { API_BASE } from '@/lib/api'          // centralised base URL

/* ───────── Types ──────────────────────────────────────────── */
interface Branch {
  id: number
  name: string
}
export interface MergeBranchesFormProps {
  onMerged?: (msg: string) => void   // optional callback
}

/* ───────── Component ─────────────────────────────────────── */
export default function MergeBranchesForm ({ onMerged }: MergeBranchesFormProps) {
  const [branches, setBranches]   = useState<Branch[]>([])
  const [source,   setSource]     = useState<string>('')   // source branch id
  const [target,   setTarget]     = useState<string>('')   // target branch id
  const [status,   setStatus]     = useState<string>('')   // UI message

  /* load branches once on mount */
  useEffect(() => {
    axios.get<Branch[]>(`${API_BASE}/branch/`)
      .then(r => setBranches(r.data))
      .catch(e => console.error('Error loading branches →', e))
  }, [])

  /* merge handler */
  const handleMerge = async () => {
    if (!source || !target || source === target) {
      return alert('Please pick two different branches')
    }
    try {
      const token = localStorage.getItem('auth_token') ?? ''
      const res   = await axios.post(
        `${API_BASE}/merge/${source}/${target}`,
        null,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      setStatus(res.data.message)
      onMerged?.(res.data.message)
    } catch (err: any) {
      const detail = err.response?.data?.detail ?? 'Merge failed'
      setStatus(`❌ ${detail}`)
    }
  }

  /* UI */
  return (
    <div className="p-4 bg-gray-900 text-gray-100 border border-gray-700 rounded">
      <h3 className="text-sm font-bold mb-3">🔀 Merge Branches</h3>

      {/* pick‑lists */}
      <div className="flex flex-col gap-3 mb-4">
        {/* source */}
        <select
          className="border border-gray-600 bg-gray-800 text-gray-100 p-2 rounded"
          value={source}
          onChange={e => setSource(e.target.value)}
        >
          <option value="">— source branch —</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name} (#{b.id})</option>
          ))}
        </select>

        {/* target */}
        <select
          className="border border-gray-600 bg-gray-800 text-gray-100 p-2 rounded"
          value={target}
          onChange={e => setTarget(e.target.value)}
        >
          <option value="">— target branch —</option>
          {branches.map(b => (
            <option key={b.id} value={b.id}>{b.name} (#{b.id})</option>
          ))}
        </select>
      </div>

      {/* action */}
      <button
        onClick={handleMerge}
        className="bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded text-sm"
      >
        Merge
      </button>

      {/* status */}
      {status && (
        <div className="mt-3 bg-blue-100 text-blue-800 p-2 rounded text-sm">
          {status}
        </div>
      )}
    </div>
  )
}
