/* ---------------------------------------------------------
   frontend/app/merge/page.tsx
----------------------------------------------------------*/
import MergeBranchesForm from '@/components/MergeBranchesForm'

/* Optional <head> metadata for the page ----------------- */
export const metadata = { title: 'Merge Branches | ChatCommit' }

/* -------------------  PAGE COMPONENT  ------------------ */
export default function MergePage() {
  return (
    <main className="max-w-lg mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">🔀 Merge Branches</h1>
      {/* ← the actual form component */}
      <MergeBranchesForm />
    </main>
  )
}
/* ------------------------------------------------------- */
