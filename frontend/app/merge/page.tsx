// frontend/app/merge/page.tsx
'use client'

import React from 'react'
import MergeForm from '@/components/MergeForm'   // <-- point at the actual filename

export default function MergePage() {
  return (
    <div className="max-w-md mx-auto mt-10">
      <MergeForm onMerged={(msg) => alert(msg)} />
    </div>
  )
}

