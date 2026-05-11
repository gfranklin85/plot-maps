'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Thread {
  lead_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  role: 'inquirer' | 'owner';
  latest_at: string | null;
  channel?: string;
  status?: string;
  score_state?: string;
}

interface Message {
  id: string;
  sender_role: 'inquirer' | 'owner' | 'system';
  body: string;
  created_at: string;
}

export default function InboxPage() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Thread | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    fetch('/api/messages/threads')
      .then(r => r.json())
      .then(d => setThreads(d.threads || []))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!active) return;
    fetch(`/api/messages/${active.lead_id}`)
      .then(r => r.json())
      .then(d => setMessages(d.messages || []));
  }, [active]);

  async function send() {
    if (!active || !draft.trim()) return;
    setSending(true);
    try {
      const body: Record<string, unknown> = { leadId: active.lead_id, body: draft };
      // Owner posting: needs threadUserId. Inquirer posting: server resolves automatically.
      // For owner role, we'd need to pick which thread (by inquirer) — Phase 1 only supports
      // owners replying to a single thread per property, so server will look up the latest
      // inquirer if not provided. We don't pass threadUserId here.
      const res = await fetch('/api/messages/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setDraft('');
        const r = await fetch(`/api/messages/${active.lead_id}`);
        const d = await r.json();
        setMessages(d.messages || []);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Threads list */}
      <aside className="md:col-span-1">
        <h1 className="text-xl font-bold text-on-surface mb-3">Inbox</h1>
        {loading ? (
          <div className="text-on-surface-variant text-sm">Loading…</div>
        ) : threads.length === 0 ? (
          <div className="text-on-surface-variant text-sm italic">
            Messages from buyers and agents will appear here. There&apos;s no need to read them on any schedule.
          </div>
        ) : (
          <ul className="space-y-1">
            {threads.map(t => (
              <li key={t.lead_id}>
                <button
                  onClick={() => setActive(t)}
                  className={`w-full text-left rounded-md p-2 text-sm transition ${
                    active?.lead_id === t.lead_id
                      ? 'bg-primary/15 border border-primary/40'
                      : 'bg-card hover:bg-surface-container-low border border-card-border'
                  }`}
                >
                  <div className="font-bold text-on-surface truncate">{t.address || 'Property'}</div>
                  <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                    {t.role === 'owner' ? 'Owner view' : 'Your inquiry'}
                  </div>
                  {t.role === 'owner' && t.score_state && (
                    <div className="text-[10px] text-emerald-400">{String(t.score_state).replace(/_/g, ' ')}</div>
                  )}
                  {t.role === 'inquirer' && (
                    <div className="text-[10px] text-on-surface-variant">
                      {t.channel} · {t.status}
                    </div>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* Thread view */}
      <section className="md:col-span-2">
        {!active ? (
          <div className="text-on-surface-variant text-sm italic mt-12 text-center">
            Pick a thread to view messages.
          </div>
        ) : (
          <div className="rounded-lg border border-card-border bg-card p-4 space-y-3">
            <h2 className="font-bold text-on-surface">{active.address}</h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {messages.length === 0 && (
                <div className="text-xs italic text-on-surface-variant">No messages yet.</div>
              )}
              {messages.map(m => (
                <div
                  key={m.id}
                  className={`rounded-md p-2 text-sm ${
                    m.sender_role === 'owner'
                      ? 'bg-emerald-500/10 border-l-2 border-emerald-500'
                      : m.sender_role === 'system'
                        ? 'bg-surface-container-low text-on-surface-variant text-xs italic'
                        : 'bg-primary/10 border-l-2 border-primary'
                  }`}
                >
                  <div className="text-[10px] uppercase tracking-widest text-on-surface-variant">
                    {m.sender_role}
                  </div>
                  <div>{m.body}</div>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                placeholder="Type a message…"
                className="flex-1 rounded border border-card-border bg-surface-container-low px-2 py-1.5 text-sm text-on-surface"
              />
              <button
                onClick={send}
                disabled={sending || !draft.trim()}
                className="rounded-md bg-primary text-on-primary px-3 py-1.5 text-sm font-bold disabled:opacity-50 flex items-center gap-1"
              >
                <MaterialIcon icon="send" className="text-[14px]" />
                Send
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
