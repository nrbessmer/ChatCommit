import { FC } from 'react';

type CommitCardProps = {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
  tags?: string[];
  hideView?: boolean;
};

const CommitCard: FC<CommitCardProps> = ({
  id,
  commit_hash,
  commit_message,
  created_at,
  tags,
  hideView = false,
}) => (
  <div className="bg-gray-800 text-gray-100 rounded-lg p-4 mb-4 shadow-lg">
    <p className="text-sm text-gray-400">Commit Hash:</p>
    <p className="font-mono text-sm text-white break-all">{commit_hash}</p>

    <p className="mt-2 text-sm text-gray-400">Message:</p>
    <p className="text-lg text-white">{commit_message}</p>

    <p className="mt-2 text-sm text-gray-400">Created At:</p>
    <p className="text-sm text-gray-300">{new Date(created_at).toLocaleString()}</p>

    {tags && tags.length > 0 && (
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map(tag => (
          <span
            key={tag}
            className="bg-yellow-600 text-yellow-100 text-xs font-medium px-2 py-1 rounded"
          >
            #{tag}
          </span>
        ))}
      </div>
    )}
  </div>
);

export default CommitCard;
