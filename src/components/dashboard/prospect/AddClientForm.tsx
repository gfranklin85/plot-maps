'use client';

// ── AddClientForm — the front door into the agent's CRM ───────────────
//
// Minimal by design (Greg): name + one contact (phone OR email) required,
// everything else optional. Rich detail arrives later through discussion,
// skip-trace, and other surfaces — NOT a full CRM form at entry. Writes to
// the `leads` table (the de-facto CRM) tagged 'client' so buyers you're
// actively working (like Alberto in escrow) are distinguishable from raw
// prospects. memory: project_two_doors_to_qualify (the person is the atom).

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';

const BRAND = 'var(--plot-brand, #1349d4)';
const INK = 'var(--plot-brand-deep, #122d8d)';

export default function AddClientForm({
  onAdded,
  onClose,
}: {
  onAdded: () => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = name.trim() && (phone.trim() || email.trim());

  async function save() {
    if (!canSave || !user) return;
    setSaving(true);
    setError(null);
    const { error } = await supabase.from('leads').insert({
      user_id: user.id,
      name: name.trim(),
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: note.trim() || null,
      status: 'New',
      source: 'Added by agent',
      tags: ['client'],
    });
    setSaving(false);
    if (error) { setError(error.message); return; }
    onAdded();
    onClose();
  }

  return (
    <div className="acf-overlay" onClick={onClose}>
      <div className="acf" onClick={(e) => e.stopPropagation()}>
        <div className="acf__head">
          <h2 className="acf__h">Add a client</h2>
          <button className="acf__x" onClick={onClose} aria-label="Close"><MaterialIcon icon="close" className="text-[20px]" /></button>
        </div>
        <p className="acf__sub">Just a name and a way to reach them. Everything else fills in as you go.</p>

        <label className="acf__field">
          <span className="acf__label">Name <b>*</b></span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Alberto Ramirez" autoFocus className="acf__input" />
        </label>
        <div className="acf__row">
          <label className="acf__field">
            <span className="acf__label">Phone</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(559) 555-0142" inputMode="tel" className="acf__input" />
          </label>
          <label className="acf__field">
            <span className="acf__label">Email</span>
            <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="alberto@email.com" inputMode="email" className="acf__input" />
          </label>
        </div>
        <p className="acf__hint">Add at least one way to reach them — phone or email.</p>
        <label className="acf__field">
          <span className="acf__label">Note <span className="acf__opt">optional</span></span>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Buyer, in escrow on 4820 Sycamore…" rows={2} className="acf__input acf__textarea" />
        </label>

        {error && <p className="acf__error">{error}</p>}

        <div className="acf__actions">
          <button className="acf__cancel" onClick={onClose}>Cancel</button>
          <button className="acf__save" disabled={!canSave || saving} onClick={save}>
            {saving ? 'Adding…' : <>Add client <MaterialIcon icon="arrow_forward" className="text-[16px]" /></>}
          </button>
        </div>

        <style>{`
          .acf-overlay { position: fixed; inset: 0; z-index: 80; display: grid; place-items: center; padding: 20px;
            background: rgba(18,45,141,0.18); backdrop-filter: blur(3px); }
          .acf { width: min(460px, 100%); background: #fff; border-radius: 22px; padding: 26px;
            box-shadow: 0 30px 70px -30px rgba(20,50,120,0.5); }
          .acf__head { display: flex; align-items: center; justify-content: space-between; }
          .acf__h { font-family: var(--font-headline, inherit); font-weight: 800; font-size: 22px; color: ${INK}; }
          .acf__x { background: none; border: none; cursor: pointer; color: #6b7699; }
          .acf__sub { font-size: 13.5px; color: #3a4a72; margin-top: 4px; line-height: 1.5; }
          .acf__field { display: block; margin-top: 16px; }
          .acf__row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .acf__label { display: block; font-size: 12px; font-weight: 700; color: ${INK}; margin-bottom: 5px; }
          .acf__label b { color: ${BRAND}; }
          .acf__opt { font-weight: 500; color: #9aa3ba; }
          .acf__input { width: 100%; padding: 11px 13px; border-radius: 11px; border: 1px solid rgba(19,73,212,0.2);
            font-size: 15px; color: ${INK}; background: #fff; outline: none; }
          .acf__input:focus { box-shadow: 0 0 0 3px rgba(19,73,212,0.16); }
          .acf__textarea { resize: vertical; font-family: inherit; }
          .acf__hint { font-size: 11.5px; color: #9aa3ba; margin-top: 6px; }
          .acf__error { font-size: 12.5px; color: #c0392b; margin-top: 12px; }
          .acf__actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 22px; }
          .acf__cancel { background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #6b7699; padding: 11px 16px; }
          .acf__save { display: inline-flex; align-items: center; gap: 7px; padding: 11px 22px; border: none; border-radius: 12px;
            background: ${BRAND}; color: #fff; font-weight: 700; font-size: 14.5px; cursor: pointer; transition: background .15s; }
          .acf__save:hover:not(:disabled) { background: ${INK}; }
          .acf__save:disabled { opacity: 0.4; cursor: not-allowed; }
        `}</style>
      </div>
    </div>
  );
}
