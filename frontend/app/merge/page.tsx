'use client';

import React from 'react';
import MergeForm from '@/components/MergeForm';

export default function MergePage() {
  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">🔀 Merge Branches</h1>
      <MergeForm />
    </main>
  );
}
