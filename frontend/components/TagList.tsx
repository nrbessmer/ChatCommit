'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';

interface Tag {
  id: number;
  name: string;
  commit_id: number;
}

interface TagListProps {
  commitId: number;
}

export default function TagList({ commitId }: TagListProps) {
  const [tags, setTags] = useState<Tag[]>([]);

  useEffect(() => {
    axios
      .get(`https://chatcommit.fly.dev/tag/commit/${commitId}`)
      .then((res) => setTags(res.data))
      .catch((err) => console.error('Error fetching tags:', err));
  }, [commitId]);

  if (tags.length === 0) return null;

  return (
    <div className="mt-3 bg-gray-900 border border-gray-700 p-3 rounded">
      <p className="text-sm font-semibold text-gray-100 mb-2">Tags</p>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="bg-yellow-600 text-yellow-100 px-2 py-1 rounded text-xs font-semibold"
          >
            #{tag.name}
          </span>
        ))}
      </div>
    </div>
  );
}
