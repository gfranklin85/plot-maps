'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useAuth } from '@/lib/auth-context';

type SelfScoreState = 'here_to_stay' | 'curious_to_hear_offers' | 'would_sell_if';
type Visibility = 'private_to_initiator' | 'public';
type ClaimantRelationship =
  | 'owner'
  | 'spouse'
  | 'managing_for_owner'
  | 'executor'
  | 'trustee'
  | 'property_manager';

const RELATIONSHIP_OPTIONS: { v: ClaimantRelationship; label: string }[] = [
  { v: 'owner', label: 'I am the owner' },
  { v: 'spouse', label: "I'm the owner's spouse" },
  { v: 'managing_for_owner', label: "I'm managing this property for the owner (parent, family member, etc.)" },
  { v: 'executor', label: "I'm the executor of an estate" },
  { v: 'trustee', label: "I'm the trustee of a trust that owns this property" },
  { v: 'property_manager', label: "I'm the property manager" },
];

interface ClaimSummary {
  token: string;
  already_claimed: boolean;
  expires_at: string | null;
  property: {
    id: string;
    address: string | null;
    city: string | null;
    state: string | null;
    zip: string | null;
  } | null;
}

const SUGGESTED_CONDITIONS = [
  { value: 'right_price', label: 'The price was right' },
  { value: 'right_buyer', label: 'The right buyer came along' },
  { value: 'in_2_years', label: 'In about 2 years' },
  { value: 'in_5_years', label: 'In about 5 years' },
  { value: 'good_schools', label: 'Better schools at destination' },
  { value: 'life_event', label: 'Job, family, or life event' },
];

export default function ClaimPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = params.token;

  const [summary, setSummary] = useState<ClaimSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form state
  const [claimantName, setClaimantName] = useState('');
  const [claimantRelationship, setClaimantRelationship] = useState<ClaimantRelationship>('owner');
  const [state, setState] = useState<SelfScoreState | null>(null);
  const [condition, setCondition] = useState('');
  const [conditionFreetext, setConditionFreetext] = useState('');
  const [destinationCity, setDestinationCity] = useState('');
  const [destinationState, setDestinationState] = useState('');
  const [destinationCondition, setDestinationCondition] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [displayName, setDisplayName] = useState('');
  const [availableToBeAsked, setAvailableToBeAsked] = useState(true);
  const [contactPhone, setContactPhone] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [smsNotifications, setSmsNotifications] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const { user } = useAuth();
  const ownerEmail = user?.email || '';

  useEffect(() => {
    if (!token) return;
    fetch(`/api/claim/${token}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setSummary(data);
      })
      .catch(() => setError('Failed to load claim'))
      .finally(() => setLoading(false));
  }, [token]);

  async function submit() {
    if (!claimantName.trim()) {
      setError('Enter your name as it appears on the property records');
      return;
    }
    if (!state) {
      setError('Pick a readiness state');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/claim/${token}/self-score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimant_name: claimantName.trim(),
          claimant_relationship: claimantRelationship,
          state,
          would_sell_if_condition: state === 'would_sell_if' ? condition || null : null,
          would_sell_if_freetext: state === 'would_sell_if' ? conditionFreetext || null : null,
          destination_city: destinationCity || null,
          destination_state: destinationState || null,
          destination_condition: destinationCondition || null,
          visibility,
          display_name: displayName || null,
          available_to_be_asked: availableToBeAsked,
          contact_phone: contactPhone.trim() || null,
          notification_email_enabled: emailNotifications,
          notification_sms_enabled: smsNotifications,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data?.code === 'name_mismatch') {
          setError(
            'Name does not match property records. If you manage this property on behalf of someone else, change your relationship selection above.',
          );
        } else {
          setError(data?.error || 'Failed to save');
        }
        return;
      }
      setDone(true);
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="p-6 text-on-surface-variant">Loading…</div>;
  if (error && !summary) return <div className="p-6 text-rose-400">{error}</div>;
  if (!summary?.property) return <div className="p-6 text-rose-400">Property not found.</div>;
  if (summary.already_claimed && !done)
    return (
      <div className="p-6 max-w-xl mx-auto space-y-2">
        <h1 className="text-xl font-bold text-on-surface">This property has already been claimed.</h1>
        <p className="text-sm text-on-surface-variant">
          If this is your property and you&apos;d like to update your readiness, sign in and visit your inbox.
        </p>
      </div>
    );

  if (done)
    return (
      <div className="p-6 max-w-xl mx-auto space-y-3">
        <h1 className="text-2xl font-bold text-on-surface">Your status is set.</h1>
        <p className="text-sm text-on-surface-variant">
          You&apos;ll get a notification any time someone is interested. You can update your status, see
          who&apos;s asking, and respond from your inbox at any time.
        </p>
        <button
          onClick={() => router.push('/dashboard/inbox')}
          className="rounded-md bg-primary text-on-primary px-3 py-1.5 text-sm font-bold"
        >
          Go to inbox
        </button>
      </div>
    );

  const prop = summary.property;
  const fullAddress = [prop.address, prop.city, prop.state, prop.zip].filter(Boolean).join(', ');

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-on-surface-variant">
          Your property
        </p>
        <h1 className="text-2xl font-bold text-on-surface">{fullAddress}</h1>
        <p className="text-sm text-on-surface-variant mt-1">
          A buyer on Plot is interested. Share your readiness anonymously — no name or number is
          revealed unless you choose. Takes 30 seconds.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Who&apos;s claiming this property?
        </h2>
        <input
          type="text"
          placeholder="Your name as it appears on the deed"
          value={claimantName}
          onChange={e => setClaimantName(e.target.value)}
          className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
        />
        <p className="text-xs text-on-surface-variant">
          Type your name exactly as it appears on the property records.
        </p>
        <div className="space-y-1">
          {RELATIONSHIP_OPTIONS.map(opt => (
            <label
              key={opt.v}
              className={`flex items-center gap-2 rounded-md border p-2 text-sm cursor-pointer ${
                claimantRelationship === opt.v
                  ? 'border-primary bg-primary/10 text-on-surface'
                  : 'border-card-border bg-card hover:bg-surface-container-low text-on-surface-variant'
              }`}
            >
              <input
                type="radio"
                name="relationship"
                checked={claimantRelationship === opt.v}
                onChange={() => setClaimantRelationship(opt.v)}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant mb-2">
          How interested are you in selling?
        </h2>
        <div className="space-y-2">
          {(
            [
              { v: 'here_to_stay', label: 'Staying put', help: "Not selling and no plans to. Plot users will see your property's status before they consider reaching out." },
              {
                v: 'curious_to_hear_offers',
                label: 'Curious to hear offers',
                help: "I'm not actively selling but I'd entertain the right offer.",
              },
              { v: 'would_sell_if', label: 'Would sell if…', help: 'There are specific conditions.' },
            ] as { v: SelfScoreState; label: string; help: string }[]
          ).map(opt => (
            <button
              key={opt.v}
              onClick={() => setState(opt.v)}
              className={`w-full text-left rounded-lg border p-3 ${
                state === opt.v
                  ? 'border-primary bg-primary/10'
                  : 'border-card-border bg-card hover:bg-surface-container-low'
              }`}
            >
              <div className="font-bold text-on-surface">{opt.label}</div>
              <div className="text-xs text-on-surface-variant">{opt.help}</div>
            </button>
          ))}
        </div>
      </section>

      {state === 'would_sell_if' && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
            What&apos;s the condition?
          </h2>
          <div className="flex flex-wrap gap-2">
            {SUGGESTED_CONDITIONS.map(c => (
              <button
                key={c.value}
                onClick={() => setCondition(condition === c.value ? '' : c.value)}
                className={`rounded-full border px-3 py-1 text-xs ${
                  condition === c.value
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-card-border text-on-surface-variant hover:bg-surface-container-low'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <textarea
            placeholder="Anything else you'd like buyers to know? (optional)"
            value={conditionFreetext}
            onChange={e => setConditionFreetext(e.target.value)}
            rows={2}
            className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface resize-y"
          />
        </section>
      )}

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          If you sold, where would you go?
        </h2>
        <p className="text-xs text-on-surface-variant">
          This helps Plot find chains — buyers in your destination, sellers in your origin.
          Optional but powerful.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="Destination city"
            value={destinationCity}
            onChange={e => setDestinationCity(e.target.value)}
            className="rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
          />
          <input
            type="text"
            placeholder="State (e.g. AZ)"
            value={destinationState}
            onChange={e => setDestinationState(e.target.value)}
            className="rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
          />
        </div>
        <input
          type="text"
          placeholder="Anything specific about the destination? (good schools, mountain town, etc.)"
          value={destinationCondition}
          onChange={e => setDestinationCondition(e.target.value)}
          className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Visibility
        </h2>
        <div className="space-y-2">
          {(
            [
              {
                v: 'public',
                label: 'Public on Plot',
                help: 'Buyers and agents on Plot can see your readiness state and reach out through Plot.',
              },
              {
                v: 'private_to_initiator',
                label: 'Only the buyer who asked',
                help: 'Only the buyer who triggered this invitation sees your response.',
              },
            ] as { v: Visibility; label: string; help: string }[]
          ).map(opt => (
            <button
              key={opt.v}
              onClick={() => setVisibility(opt.v)}
              className={`w-full text-left rounded-lg border p-3 ${
                visibility === opt.v
                  ? 'border-primary bg-primary/10'
                  : 'border-card-border bg-card hover:bg-surface-container-low'
              }`}
            >
              <div className="font-bold text-on-surface">{opt.label}</div>
              <div className="text-xs text-on-surface-variant">{opt.help}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Your avatar
        </h2>
        <input
          type="text"
          placeholder="Avatar name buyers see (e.g. Owner of 123 Oak)"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
        />
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={availableToBeAsked}
            onChange={e => setAvailableToBeAsked(e.target.checked)}
          />
          Allow Lite buyers to dial me through Plot (always masked).
        </label>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-on-surface-variant">
          Notification preferences
        </h2>
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant">Email</label>
          <input
            type="email"
            value={ownerEmail}
            disabled
            className="w-full rounded border border-card-border bg-surface-container-low px-2 py-1.5 text-sm text-on-surface-variant"
          />
          <p className="text-xs text-on-surface-variant">
            We&apos;ll send a Plot notification here when there&apos;s new activity.
          </p>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-on-surface-variant">Phone (optional)</label>
          <input
            type="tel"
            placeholder="(optional)"
            value={contactPhone}
            onChange={e => {
              setContactPhone(e.target.value);
              if (e.target.value.trim()) setSmsNotifications(true);
              else setSmsNotifications(false);
            }}
            className="w-full rounded border border-card-border bg-card px-2 py-1.5 text-sm text-on-surface"
          />
          <p className="text-xs text-on-surface-variant">
            Anonymous — never shared with other Plot users. We only use it to text you when there&apos;s new activity and you aren&apos;t on Plot.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={emailNotifications}
            onChange={e => setEmailNotifications(e.target.checked)}
          />
          Email me when there&apos;s new activity.
        </label>
        <label className="flex items-center gap-2 text-sm text-on-surface">
          <input
            type="checkbox"
            checked={smsNotifications}
            disabled={!contactPhone.trim()}
            onChange={e => setSmsNotifications(e.target.checked)}
          />
          Text me when there&apos;s new activity.
        </label>
      </section>

      {error && <div className="text-rose-400 text-sm">{error}</div>}

      <button
        onClick={submit}
        disabled={!state || submitting}
        className="w-full rounded-md bg-primary text-on-primary py-2 text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <MaterialIcon icon="check" className="text-[16px]" />
        {submitting ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}
