'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import axios from 'axios';
import TagForm from '@/components/TagForm';
import TagList from '@/components/TagList';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  ShadingType,
} from 'docx';
import { saveAs } from 'file-saver';

interface CommitData {
  id: number;
  commit_hash: string;
  commit_message: string;
  created_at: string;
  conversation_context: {
    messages?: string[];
    [key: string]: any;
  };
}

interface Tag {
  id: number;
  name: string;
  commit_id: number;
}

export default function CommitDetailPage() {
  const { id } = useParams() as { id: string };
  const commitId = Number(id);
  const [commit, setCommit] = useState<CommitData | null>(null);
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showPretty, setShowPretty] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (!commitId) {
      setLoading(false);
      return;
    }

    Promise.all([
      axios.get<CommitData>(`https://chatcommit.fly.dev/commit/${commitId}`),
      axios.get<Tag[]>(`https://chatcommit.fly.dev/tag/commit/${commitId}`)
    ])
      .then(([cRes, tRes]) => {
        setCommit(cRes.data);
        setTags(tRes.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [commitId]);

  if (loading) return <p className="p-6 text-white">Loading...</p>;
  if (!commit) return <p className="p-6 text-red-500">Commit not found.</p>;

  const msgs = commit.conversation_context.messages || [];

  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Commit Details',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({}),
          new Paragraph({
            children: [
              new TextRun({ text: 'Hash: ', bold: true }),
              new TextRun(commit.commit_hash),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Message: ', bold: true }),
              new TextRun(commit.commit_message),
            ],
          }),
          new Paragraph({
            children: [
              new TextRun({ text: 'Created At: ', bold: true }),
              new TextRun(new Date(commit.created_at).toLocaleString()),
            ],
          }),
          new Paragraph({}),
          new Paragraph({ text: 'Conversation', heading: HeadingLevel.HEADING_2 }),
          ...msgs.map((m, i) =>
            new Paragraph({
              children: [new TextRun(m)],
              shading: {
                type: ShadingType.CLEAR,
                color: 'auto',
                fill: m.startsWith('User') ? 'ADD8E6' : '90EE90',
              },
            })
          ),
          new Paragraph({}),
          new Paragraph({ text: 'Tags', heading: HeadingLevel.HEADING_2 }),
          ...tags.map(t =>
            new Paragraph({
              children: [new TextRun(t.name)],
              bullet: { level: 0 },
            })
          ),
        ],
      }],
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, `commit-${commit.commit_hash.slice(0, 8)}.docx`);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 bg-gray-900 text-gray-100 rounded-md">
      <button
        className="text-sm text-blue-400 hover:underline mb-4"
        onClick={() => router.back()}
      >
        ← Back
      </button>

      <h1 className="text-2xl font-bold mb-4">Commit Details</h1>

      <button
        className="mb-4 bg-green-600 text-white px-3 py-1 rounded"
        onClick={exportToWord}
      >
        📄 Export to Word
      </button>

      <div className="p-4 rounded border border-gray-700 bg-gray-800 mb-6">
        <p className="text-gray-400 text-sm mb-1">Hash:</p>
        <p className="font-mono text-blue-300 text-sm mb-3">{commit.commit_hash}</p>

        <p className="text-gray-400 text-sm mb-1">Message:</p>
        <p className="text-lg font-semibold text-gray-100 mb-3">{commit.commit_message}</p>

        <p className="text-gray-400 text-sm mb-1">Created:</p>
        <p className="text-sm text-gray-200 mb-4">
          {new Date(commit.created_at).toLocaleString()}
        </p>

        <div className="mb-4">
          <TagForm commitId={commit.id} onCreated={() => {/* refresh tags logic */}} />
          <TagList commitId={commit.id} />
        </div>

        <div className="flex gap-2 mb-4">
          <button
            className="bg-green-600 text-white px-3 py-1 rounded"
            onClick={() => setShowPretty(v => !v)}
          >
            {showPretty ? 'Hide Messages' : 'Show Messages'}
          </button>
          <button
            className="bg-blue-600 text-white px-3 py-1 rounded"
            onClick={() => setShowRawJson(v => !v)}
          >
            {showRawJson ? 'Hide Raw JSON' : 'Show Raw JSON'}
          </button>
        </div>

        {showPretty && (
          <div className="mb-4 space-y-2">
            {msgs.length > 0 ? (
              msgs.map((m, i) => (
                <p key={i} className="bg-gray-700 p-2 rounded text-sm leading-snug">
                  {m}
                </p>
              ))
            ) : (
              <p className="text-gray-500 text-sm">No messages.</p>
            )}
          </div>
        )}

        {showRawJson && (
          <pre className="bg-gray-700 border border-gray-600 p-4 rounded text-sm text-green-200 overflow-auto">
            {JSON.stringify(commit.conversation_context, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}
