import { FC } from 'react';
import Link from 'next/link';

type CommitCardProps = {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
  tags?: string[];
  hideView?: boolean;   // New prop to hide the View button
};

const CommitCard: FC<CommitCardProps> = ({
  id,
  commit_hash,
  commit_message,
  created_at,
  branch_id,
  tags,
  hideView = false,
}) => {
  return (
    <div className="bg-white shadow-md rounded-xl p-4 mb-4 border hover:shadow-lg transition-all">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm text-gray-400">Commit:</p>
          <p className="font-mono text-xs text-blue-700 truncate">{commit_hash}</p>
          <p className="text-lg font-semibold mt-1">{commit_message}</p>
          <p className="text-sm text-gray-500 mt-1">
            {new Date(created_at).toLocaleString()}
          </p>
          {tags && tags.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-block bg-yellow-100 text-yellow-800 text-xs font-medium px-2 py-1 rounded"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
        {/* Conditionally render the View button */}
        {!hideView && (
          <Link
            href={`/commit/${id}`}
            className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700"
          >
            View
          </Link>
        )}
      </div>
    </div>
  );
};

export default CommitCard;
