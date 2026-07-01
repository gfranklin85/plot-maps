'use client';

// AgentInvite (/invite) — the agent's tool. Fill it once, get a branded link
// to text any ready buyer. The buyer completes their position, it auto-attaches
// to the agent, and it lands on the PUBLIC bullpen where lenders compete —
// which is what keeps it RESPA-clean AND gets the buyer a better deal. The
// agent brands it; it all runs on PlotMaps underneath.
// See memory/project_agent_branded_template.

import { useState } from 'react';
import Link from 'next/link';
import PlotMapsLogo from '@/components/brand/PlotMapsLogo';
import PositionFooter from '@/components/public/PositionFooter';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function AgentInvite() {
  const [f, setF] = useState<Record<string, string>>({});
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState<'link' | 'text' | null>(null);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const link = token && typeof window !== 'undefined'
    ? `${window.location.origin}/bullpen?agent=${token}`
    : token ? `/bullpen?agent=${token}` : '';

  const textMsg = `Hey! Since you're getting ready to buy, I set up your buyer profile — just fill in a few basics here and lenders will compete for your business (you compare and pick, no pressure): ${link}`;

  async function create() {
    setBusy(true); setErr(null);
    try {
      const res = await fetch('/api/agent-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: f.agentName,
          agentEmail: f.agentEmail,
          agentPhone: f.agentPhone,
          brokerage: f.brokerage,
          logoUrl: f.logoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) throw new Error(data.error || 'Something went wrong');
      setToken(data.token);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  const copy = async (kind: 'link' | 'text', value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      setTimeout(() => setCopied(null), 1800);
    } catch { /* selectable fallback */ }
  };

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0c1322]">
      <header className="px-6 md:px-10 pt-6 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <PlotMapsLogo color="#0c1322" className="h-7 w-auto" />
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-[#4a5568]">
          <Link href="/buyers" className="hover:text-[#1349d4] transition-colors">Browse buyers</Link>
          <Link href="/position" className="hover:text-[#1349d4] transition-colors">Position</Link>
        </nav>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-2xl px-6 py-10">
          {!token ? (
            <>
              <div className="text-center mb-8">
                <div className="text-[10px] uppercase tracking-[0.4em] font-bold text-[#1349d4]">
                  For agents · free
                </div>
                <h1 className="font-headline text-3xl md:text-4xl font-extrabold mt-3 leading-tight">
                  A link for every buyer you know.
                </h1>
                <p className="text-[15px] mt-4 text-[#4a5568] leading-relaxed max-w-xl mx-auto">
                  Meet a buyer who&apos;s ready? Send them your link. They fill in a
                  few basics, and you post it — then lenders compete for their
                  business. It lands on the public board, so it stays clean and open
                  (no steering), and the buyer gets a better deal for it. Your buyer,
                  your brand — it just runs on PlotMaps.
                </p>
              </div>

              <div className="ai-form">
                <div className="ai-form__row">
                  <Field label="Your name *" v={f.agentName} onChange={(v) => set('agentName', v)} placeholder="Greg Franklin" />
                  <Field label="Brokerage" v={f.brokerage} onChange={(v) => set('brokerage', v)} placeholder="Position Realty" />
                </div>
                <div className="ai-form__row">
                  <Field label="Email" v={f.agentEmail} onChange={(v) => set('agentEmail', v)} placeholder="greg@position.realty" />
                  <Field label="Phone" v={f.agentPhone} onChange={(v) => set('agentPhone', v)} placeholder="(559) 555-0134" />
                </div>
                <Field label="Logo URL (optional — your brand on the buyer's page)" v={f.logoUrl} onChange={(v) => set('logoUrl', v)} placeholder="https://…/your-logo.png" />

                {err && <p className="ai-form__err"><MaterialIcon icon="error_outline" className="text-[16px]" /> {err}</p>}
                <button className="ai-form__submit" onClick={create} disabled={busy || !f.agentName?.trim()}>
                  {busy ? 'Creating…' : 'Create my buyer link →'}
                </button>
                <p className="ai-form__fine">No account needed. Make one link and reuse it with every buyer.</p>
              </div>
            </>
          ) : (
            <div className="ai-done">
              <div className="ai-badge"><MaterialIcon icon="link" className="text-[28px]" /></div>
              <h2>Your link is ready, {f.agentName?.split(' ')[0]}.</h2>
              <p>Text it to any buyer who&apos;s getting ready. When they finish, it&apos;s attached to you — and it goes on the board where lenders compete.</p>

              <div className="ai-linkrow">
                <input className="ai-link" readOnly value={link} onFocus={(e) => e.currentTarget.select()} />
                <button className="ai-copy" onClick={() => copy('link', link)}>
                  <MaterialIcon icon={copied === 'link' ? 'check' : 'content_copy'} className="text-[17px]" />
                  {copied === 'link' ? 'Copied' : 'Copy link'}
                </button>
              </div>

              <div className="ai-text">
                <div className="ai-text__label">A message you can send</div>
                <p className="ai-text__body">{textMsg}</p>
                <button className="ai-text__copy" onClick={() => copy('text', textMsg)}>
                  <MaterialIcon icon={copied === 'text' ? 'check' : 'sms'} className="text-[16px]" />
                  {copied === 'text' ? 'Copied' : 'Copy message'}
                </button>
              </div>

              <div className="ai-how">
                <div className="ai-how__step"><b>1</b> They tap your link and fill in a few basics.</div>
                <div className="ai-how__step"><b>2</b> It posts to the public board — attached to you.</div>
                <div className="ai-how__step"><b>3</b> Lenders compete; the buyer compares and picks.</div>
              </div>

              <a href={link} className="ai-preview">Preview what your buyer sees →</a>
            </div>
          )}
        </section>
      </main>

      <PositionFooter />
    </div>
  );
}

function Field({ label, v, onChange, placeholder }: {
  label: string; v?: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <label className="ai-field">
      <span className="ai-field__label">{label}</span>
      <input className="ai-field__input" value={v ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </label>
  );
}
