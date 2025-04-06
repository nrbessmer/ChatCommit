cat > app/commit/page.tsx << 'EOF'
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';

interface Commit {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
}

export default function CommitListPage() {
  const [commits, setCommits] = useState<Commit[]>([]);

  useEffect(() => {
    axios.get<Commit[]>('https://chatcommit.fly.dev/commit/')
      .then(res => setCommits(res.data))
      .catch(console.error);
  }, []);

  return (
    <div className="max-w-3xl mx-auto p-6 text-white">
      <h2 className="text-2xl font-bold mb-4">All Commits</h2>
      {commits.map(c => (
        <div key={c.id} className="mb-4">
          <Link href={`/commit/${c.id}`}>
            {c.commit_hash.slice(0,8)} - {c.commit_message}
          </Link>
        </div>
      ))}
    </div>
  );
}
EOF
