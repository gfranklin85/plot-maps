'use client';

import { useEffect, useState } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface VerificationRequest {
  lead_id: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  requested_at: string;
}

export default function AgentVerificationsPage() {
  const [requests, setRequests] = useState<VerificationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLicense, setNeedsLicense] = useState(false);
  const [licenseId, setLicenseId] = useState('');
  const [licenseSaving, setLicenseSaving] = useState(false);
  const [active, setActive] = useState<VerificationRequest | null>(null);
  const [attestedName, setAttestedName] = useState('');
  const [attestNotes, setAttestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/verification-queue');
      const data = await res.json();
      setRequests(data?.requests || []);
      setNeedsLicense(!!data?.needs_license);
    } finally {
      setLoading(false);
    }
  }

  async function saveLicense() {
    if (!licenseId.trim()) return;
    setLicenseSaving(true);
    try {
      // We piggy-back on the profile patch via Supabase admin path through a small endpoint;
      // for v1 we wire this through a generic profile update via the existing profile context
      // by calling a simple inline route. Using the same arm-channel pattern.
      await fetch('/api/profile/dre-license', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dre_license_id: licenseId.trim() }),
      });
      setNeedsLicense(false);
      await load();
    } finally {
      setLicenseSaving(false);
    }
  }

  async function submitAttestation() {
    if (!active || !attestedName.trim()) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch('/api/agent/attest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: active.lead_id,
          attestedOwnerName: attestedName.trim(),
          notes: attestNotes || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(data?.error || 'Attestation failed');
        return;
      }
      setMessage('Attestation recorded.');
      setActive(null);
      setAttestedName('');
      setAttestNotes('');
      await load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold text-on-surface mb-1">Agent verifications</h1>
      <p className="text-sm text-on-surface-variant mb-6">
        Owners who&apos;ve requested an agent attestation appear here. Verifying an owner records
        your DRE license against the property as a vouch of identity. Plot does not give you
        any special claim on the property — it&apos;s just a courtesy and a head-start on a
        relationship.
      </p>

      {needsLicense && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mb-6 space-y-2">
          <div className="font-bold text-on-surface">Add your license to verify owners</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="DRE license number"
              value={licenseId}
              onChange={e => setLicenseId(e.target.value)}
              className="flex-1 rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
            />
            <button
              onClick={saveLicense}
              disabled={licenseSaving || !licenseId.trim()}
              className="rounded-md bg-primary text-on-primary px-3 py-1.5 text-sm font-bold disabled:opacity-50"
            >
              {licenseSaving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {message && (
        <div className="rounded-md bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-sm text-emerald-300 mb-4">
          {message}
        </div>
      )}

      {loading ? (
        <div className="text-on-surface-variant">Loading…</div>
      ) : requests.length === 0 && !needsLicense ? (
        <div className="text-on-surface-variant italic text-sm">No verification requests right now.</div>
      ) : (
        <ul className="space-y-2">
          {requests.map(r => (
            <li
              key={r.lead_id}
              className="rounded-lg border border-card-border bg-card p-3 flex items-center justify-between"
            >
              <div>
                <div className="font-bold text-on-surface">
                  {[r.address, r.city, r.state].filter(Boolean).join(', ')}
                </div>
                <div className="text-[11px] uppercase tracking-widest text-on-surface-variant">
                  Requested {new Date(r.requested_at).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={() => setActive(r)}
                disabled={needsLicense}
                className="rounded-md bg-primary/15 hover:bg-primary/25 px-3 py-1.5 text-xs font-bold text-primary disabled:opacity-50"
              >
                Verify
              </button>
            </li>
          ))}
        </ul>
      )}

      {active && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-lg bg-card border border-card-border p-4 space-y-3">
            <h2 className="font-bold text-on-surface">Verify owner</h2>
            <p className="text-xs text-on-surface-variant">
              {[active.address, active.city, active.state].filter(Boolean).join(', ')}
            </p>
            <input
              type="text"
              placeholder="Owner's name (as you verified it)"
              value={attestedName}
              onChange={e => setAttestedName(e.target.value)}
              className="w-full rounded border border-card-border bg-surface-container-low px-2 py-1.5 text-sm text-on-surface"
            />
            <textarea
              rows={3}
              placeholder="Notes on how you verified (optional)"
              value={attestNotes}
              onChange={e => setAttestNotes(e.target.value)}
              className="w-full rounded border border-card-border bg-surface-container-low px-2 py-1.5 text-sm text-on-surface resize-y"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setActive(null)}
                className="rounded-md bg-surface-container px-3 py-1.5 text-sm font-bold text-on-surface"
              >
                Cancel
              </button>
              <button
                onClick={submitAttestation}
                disabled={submitting || !attestedName.trim()}
                className="rounded-md bg-primary text-on-primary px-3 py-1.5 text-sm font-bold disabled:opacity-50 flex items-center gap-1"
              >
                <MaterialIcon icon="verified_user" className="text-[14px]" />
                {submitting ? 'Submitting…' : 'Submit attestation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
