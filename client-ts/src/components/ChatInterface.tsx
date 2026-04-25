'use client';

import { useState, useRef, FormEvent, KeyboardEvent } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { ChatMessage, ApiResponse } from '@/lib/types';
import MessageList from './MessageList';

export default function ChatInterface() {
  const { data: session } = useSession();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function sendMessage() {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: ChatMessage = { role: 'user', text: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setLoading(true);

    // Resize textarea back to default
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.text }));

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history }),
      });

      const json: ApiResponse & { error?: string } = await res.json();

      if (!res.ok || json.error) {
        const errMsg: ChatMessage = {
          role: 'assistant',
          text: json.error ?? 'Something went wrong. Please try again.',
        };
        setMessages([...updatedMessages, errMsg]);
        return;
      }

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        text: json.text,
        visualizations: json.visualizations,
      };

      setMessages([...updatedMessages, assistantMessage]);
    } catch (err) {
      const errMsg: ChatMessage = {
        role: 'assistant',
        text: 'Network error — could not reach the server.',
      };
      setMessages([...updatedMessages, errMsg]);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    sendMessage();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  function handleTextareaChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setInput(e.target.value);
    // Auto-resize textarea
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto w-full">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
          <svg
            className="w-4 h-4 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M20 7l-8 5-8-5V5l8 5 8-5v2z"
            />
          </svg>
        </div>
        <div className="flex-1">
          <h1 className="text-base font-semibold text-gray-900">SQL Analytics</h1>
          <p className="text-xs text-gray-500">Ask questions about your financial database</p>
        </div>
        {session?.user && (
          <div className="flex items-center gap-3 ml-auto">
            {session.user.image && (
              <img src={session.user.image} alt={session.user.name ?? ''} className="w-7 h-7 rounded-full" />
            )}
            <span className="text-xs text-gray-500 hidden sm:block">{session.user.name}</span>
            <button
              onClick={() => signOut({ callbackUrl: '/signin' })}
              className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}
      </div>

      {/* Message area */}
      <div className="flex-1 overflow-y-auto px-6 bg-gray-50">
        {messages.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-16">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
              <svg
                className="w-8 h-8 text-blue-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 10h18M3 14h18M10 4v16M14 4v16"
                />
              </svg>
            </div>
            <h2 className="text-lg font-medium text-gray-700 mb-2">
              Ask about your financial data
            </h2>
            <p className="text-sm text-gray-500 max-w-sm">
              Try: &ldquo;Show me the top 10 accounts by balance&rdquo; or &ldquo;What are the
              most recent transactions?&rdquo;
            </p>
          </div>
        ) : (
          <MessageList messages={messages} loading={loading} />
        )}
      </div>

      {/* Input area */}
      <div className="border-t border-gray-200 bg-white px-6 py-4">
        <form onSubmit={handleSubmit} className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question… (Enter to send, Shift+Enter for newline)"
            rows={1}
            disabled={loading}
            className="flex-1 resize-none rounded-xl border border-gray-300 bg-gray-50 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:opacity-50 transition-colors"
            style={{ minHeight: '48px', maxHeight: '160px' }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="flex-shrink-0 rounded-xl bg-blue-500 px-4 py-3 text-white text-sm font-medium hover:bg-blue-600 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-300 transition-colors"
            aria-label="Send message"
          >
            {loading ? (
              <svg
                className="w-5 h-5 animate-spin"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
            ) : (
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </form>
        <p className="mt-2 text-xs text-gray-400 text-center">
          Powered by Claude claude-sonnet-4-6 + MCP
        </p>
      </div>
    </div>
  );
}
