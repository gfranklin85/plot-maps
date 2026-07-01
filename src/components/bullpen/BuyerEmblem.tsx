'use client';

// BuyerEmblem — the buyer's public marker: a CIRCLE avatar colored + iconed by
// WORK-LANE (derived from their occupation text). NOT a photo, NOT identity,
// NOT a shield (too heraldic). Fair-Housing-clean: it keys off the KIND of work
// (a public, non-protected signal a local lender reads as fundability), never a
// protected class. See memory/project_buyer_emblem_crest + project_lender_fee_worksheet.

import MaterialIcon from '@/components/ui/MaterialIcon';

type Lane = {
  id: string;
  icon: string;
  from: string;
  to: string;
  match: RegExp;
};

// Order matters — first match wins. Keywords are broad + local-market aware.
const LANES: Lane[] = [
  { id: 'military', icon: 'anchor', from: '#1b3a6b', to: '#0f2547',
    match: /\b(navy|army|air ?force|marine|military|nas|base|lt|lieutenant|sergeant|chief|petty officer|airman|seaman|corps|active duty|veteran|va)\b/i },
  { id: 'public-safety', icon: 'local_police', from: '#243b6b', to: '#16264a',
    match: /\b(correctional|corrections|co\b|police|officer|deputy|sheriff|firefighter|fire|paramedic|emt|dispatch|prison|patrol)\b/i },
  { id: 'medical', icon: 'medical_services', from: '#0f6d5c', to: '#0a4c40',
    match: /\b(nurse|rn|lvn|doctor|physician|md|medical|health|hospital|clinic|dental|dentist|therapist|pharmac|caregiver|cna)\b/i },
  { id: 'education', icon: 'school', from: '#7a4a12', to: '#5a360c',
    match: /\b(teacher|educator|professor|school|principal|counselor|tutor|faculty|district)\b/i },
  { id: 'trades', icon: 'handyman', from: '#8a5a16', to: '#663f0e',
    match: /\b(electric|plumb|hvac|contractor|welder|mechanic|carpenter|construction|technician|operator|installer|maintenance|foreman|laborer|driver|trucking|cdl)\b/i },
  { id: 'government', icon: 'account_balance', from: '#3a3f66', to: '#242848',
    match: /\b(city|county|state|federal|gov|government|clerk|postal|usps|dmv|court|administration|public works)\b/i },
  { id: 'agriculture', icon: 'agriculture', from: '#4a6317', to: '#324310',
    match: /\b(farm|ag\b|agricul|dairy|ranch|grower|packing|harvest|orchard|vineyard|irrigation)\b/i },
  { id: 'service', icon: 'store', from: '#6b3a5a', to: '#4a2740',
    match: /\b(manager|retail|sales|server|clerk|hospitality|hotel|restaurant|cook|barista|cashier|customer)\b/i },
  { id: 'professional', icon: 'work', from: '#2a4a7a', to: '#1a3054',
    match: /\b(engineer|analyst|accountant|attorney|lawyer|consultant|developer|designer|finance|banker|realtor|agent|broker|architect)\b/i },
];

const DEFAULT_LANE: Lane = { id: 'other', icon: 'badge', from: '#3a4a66', to: '#232f47', match: /.*/ };

export function laneFor(occupation: string | null | undefined): Lane {
  const t = occupation || '';
  return LANES.find((l) => l.match.test(t)) || DEFAULT_LANE;
}

export default function BuyerEmblem({
  occupation,
  size = 52,
}: {
  occupation: string | null | undefined;
  size?: number;
}) {
  const lane = laneFor(occupation);
  const iconSize = Math.round(size * 0.44);
  return (
    <div
      className="be-emblem"
      style={{
        width: size,
        height: size,
        borderRadius: '50%', // a clean circle, not a shield
        background: `linear-gradient(155deg, ${lane.from}, ${lane.to})`,
      }}
      aria-hidden
    >
      <MaterialIcon icon={lane.icon} className="be-emblem__icon" filled />
      <style jsx>{`
        .be-emblem :global(.be-emblem__icon) {
          font-size: ${iconSize}px;
          color: rgba(255, 255, 255, 0.94);
        }
      `}</style>
    </div>
  );
}
