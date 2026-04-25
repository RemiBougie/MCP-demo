'use client';

import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChatMessage } from '@/lib/types';
import { componentRegistry } from '@/ui-components/registry';

interface MessageListProps {
  messages: ChatMessage[];
  loading: boolean;
}

export default function MessageList({ messages, loading }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex flex-col gap-4 py-4">
      {messages.map((msg, idx) => {
        if (msg.role === 'user') {
          return (
            <div key={idx} className="flex justify-end">
              <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-blue-500 px-4 py-3 text-white shadow-sm">
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.text}</p>
              </div>
            </div>
          );
        }

        // Assistant message
        return (
          <div key={idx} className="flex justify-start">
            <div className="max-w-[90%] rounded-2xl rounded-tl-sm bg-white border border-gray-200 px-4 py-3 shadow-sm">
              {msg.visualizations?.map((viz, vizIdx) => {
                const DataComponent = componentRegistry[viz.component] ?? null;
                return DataComponent ? (
                  <DataComponent key={vizIdx} columns={viz.columns} data={viz.data} />
                ) : null;
              })}
              <div className="prose prose-sm prose-gray max-w-none mt-3 text-gray-800">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {msg.text}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        );
      })}

      {loading && (
        <div className="flex justify-start">
          <div className="rounded-2xl rounded-tl-sm bg-white border border-gray-200 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 text-gray-500 text-sm">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:0ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:150ms]" />
                <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:300ms]" />
              </span>
              <span>Thinking…</span>
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
