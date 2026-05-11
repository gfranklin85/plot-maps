'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

type Channel = 'text_invite' | 'direct_mail' | 'phone_call';
type Edition = 'lite' | 'pro';

interface MailTemplate {
  id: string;
  name: string;
  body_text: string;
  is_default: boolean;
}

const CHANNEL_LABELS: Record<Channel, { title: string; help: string; icon: string }> = {
  text_invite: {
    title: 'Plot text invitation',
    help: "Plot-templated SMS to the owner inviting them to anonymously self-score. Owner phone is never shown to you.",
    icon: 'mail',
  },
  direct_mail: {
    title: 'Direct mail letter',
    help: 'Mails your active letter template to the property address. Author your letters below.',
    icon: 'inventory_2',
  },
  phone_call: {
    title: 'Phone call (web app)',
    help: 'Dial the owner through Plot. Lite users can only dial owners who have registered as available-to-be-asked.',
    icon: 'call',
  },
};

export default function ArmingPage() {
  const [edition, setEdition] = useState<Edition>('lite');
  const [armedChannel, setArmedChannel] = useState<Channel | null>(null);
  const [armedMailTemplateId, setArmedMailTemplateId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<{ id?: string; name: string; body_text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const [armedRes, tmplRes] = await Promise.all([
        fetch('/api/profile/arm-channel'),
        fetch('/api/mail-templates'),
      ]);
      const armed = await armedRes.json().catch(() => ({}));
      const tmpls = await tmplRes.json().catch(() => ({}));
      setEdition((armed?.plot_edition as Edition) || 'lite');
      setArmedChannel((armed?.armed_channel as Channel) || null);
      setArmedMailTemplateId(armed?.armed_mail_template_id || null);
      setTemplates(tmpls?.templates || []);
    } finally {
      setLoading(false);
    }
  }

  async function armChannel(channel: Channel) {
    setArmedChannel(channel);
    await fetch('/api/profile/arm-channel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel }),
    });
  }

  async function saveTemplate() {
    if (!editing || !editing.name || !editing.body_text) return;
    setSaving(true);
    try {
      if (editing.id) {
        await fetch(`/api/mail-templates/${editing.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editing.name, body_text: editing.body_text }),
        });
      } else {
        await fetch('/api/mail-templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: editing.name, body_text: editing.body_text }),
        });
      }
      setEditing(null);
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function armTemplate(id: string) {
    setArmedMailTemplateId(id);
    await fetch(`/api/mail-templates/${id}/arm`, { method: 'POST' });
  }

  async function deleteTemplate(id: string) {
    await fetch(`/api/mail-templates/${id}`, { method: 'DELETE' });
    if (armedMailTemplateId === id) setArmedMailTemplateId(null);
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl p-6">
      <h1 className="text-2xl font-bold text-on-surface mb-1">Armory</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Pick the channel that fires when you grab a property and pull RT in the airplane game.
        Plot edition: <span className="font-semibold">{edition.toUpperCase()}</span>
      </p>

      {loading ? (
        <div className="text-on-surface-variant">Loading…</div>
      ) : (
        <>
          <section className="space-y-3 mb-8">
            <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
              Active channel
            </h2>
            {(Object.keys(CHANNEL_LABELS) as Channel[]).map(ch => {
              const isArmed = armedChannel === ch;
              const meta = CHANNEL_LABELS[ch];
              return (
                <button
                  key={ch}
                  onClick={() => armChannel(ch)}
                  className={`w-full text-left rounded-lg border p-3 transition ${
                    isArmed
                      ? 'border-primary bg-primary/10'
                      : 'border-card-border bg-card hover:bg-surface-container-low'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <MaterialIcon icon={meta.icon} className="text-[18px] text-primary" />
                    <span className="font-bold text-on-surface">{meta.title}</span>
                    {isArmed && (
                      <span className="ml-auto text-[10px] font-bold uppercase tracking-widest text-primary">
                        Armed
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">{meta.help}</p>
                </button>
              );
            })}
          </section>

          <section>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
                Mail templates
              </h2>
              <button
                onClick={() => setEditing({ name: '', body_text: '' })}
                className="text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
              >
                + New
              </button>
            </div>

            {editing && (
              <div className="rounded-lg border border-primary/40 bg-surface-container-low p-3 mb-3 space-y-2">
                <input
                  type="text"
                  placeholder="Template name"
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
                />
                <textarea
                  rows={6}
                  placeholder="Letter body. Use {{property_address}} and {{owner_avatar}} as placeholders."
                  value={editing.body_text}
                  onChange={e => setEditing({ ...editing, body_text: e.target.value })}
                  className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface leading-snug resize-y"
                />
                <div className="flex gap-2">
                  <button
                    onClick={saveTemplate}
                    disabled={saving || !editing.name || !editing.body_text}
                    className="rounded-md bg-primary text-on-primary px-3 py-1 text-xs font-bold disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => setEditing(null)}
                    className="rounded-md bg-surface-container px-3 py-1 text-xs font-bold text-on-surface"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {templates.length === 0 && !editing && (
                <div className="text-xs text-on-surface-variant italic">
                  No mail templates yet. Author one above.
                </div>
              )}
              {templates.map(t => {
                const isArmed = armedMailTemplateId === t.id;
                return (
                  <div
                    key={t.id}
                    className={`rounded-lg border p-3 ${
                      isArmed ? 'border-amber-500/60 bg-amber-500/5' : 'border-card-border bg-card'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-on-surface">{t.name}</span>
                      {isArmed && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400">
                          Armed
                        </span>
                      )}
                    </div>
                    <pre className="text-xs text-on-surface-variant whitespace-pre-wrap mt-1">
                      {t.body_text}
                    </pre>
                    <div className="flex gap-3 mt-2">
                      {!isArmed && (
                        <button
                          onClick={() => armTemplate(t.id)}
                          className="text-[11px] font-bold uppercase tracking-widest text-primary hover:underline"
                        >
                          Arm
                        </button>
                      )}
                      <button
                        onClick={() => setEditing({ id: t.id, name: t.name, body_text: t.body_text })}
                        className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTemplate(t.id)}
                        className="text-[11px] font-bold uppercase tracking-widest text-rose-400 hover:underline"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
