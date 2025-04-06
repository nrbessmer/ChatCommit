import { FC, useState } from 'react';
import Link from 'next/link';

type CommitCardProps = {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  branch_id?: number;
  tags?: string[];
  conversation_context?: { messages: string[] };
  hideView?: boolean;
};

const CommitCard: FC<CommitCardProps> = ({
  id,
  commit_hash,
  commit_message,
  created_at,
  tags,
  conversation_context,
  hideView = false,
}) => {
  const [showContext, setShowContext] = useState(false);

  const copyContext = () => {
    if (!conversation_context) return;
    const text = JSON.stringify(conversation_context, null, 2);
    navigator.clipboard.writeText(text)
      .then(() => alert('Context copied!'))
      .catch(() => alert('Copy failed.'));
  };

  return (
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

      {conversation_context && (
        <div className="mt-3">
          <button
            onClick={() => setShowContext(!showContext)}
            className="text-blue-400 hover:underline text-sm"
          >
            {showContext ? 'Hide Context' : 'Show Context'}
          </button>
          {showContext && (
            <div className="relative mt-2">
              <button
                onClick={copyContext}
                aria-label="Copy context"
                className="absolute top-0 right-0 p-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
              >
                {/* Copy icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none"
                  viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h6m4 0h2a2 2 0 012 2v8a2 2 0 01-2 2h-2M8 12h6m-6 4h6" />
                </svg>
              </button>
              <div className="bg-gray-700 p-3 rounded max-h-48 overflow-y-auto text-gray-200 font-mono text-sm">
                {conversation_context.messages.map((msg, i) => (
                  <p key={i} className="mb-2">{msg}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {!hideView && (
        <Link href={`/commit/${id}`} className="mt-3 inline-block text-blue-400 hover:underline text-sm">
          View Details →
        </Link>
      )}
    </div>
  );
};

export default CommitCard;
