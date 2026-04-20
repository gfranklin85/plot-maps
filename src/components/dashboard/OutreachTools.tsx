'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

interface Usage {
  ai_minutes_used: number;
  ai_minutes_limit: number;
}

interface Props {
  usage: Usage | null;
}

function minutesBadge(usage: Usage | null): { label: string; lowAlert: boolean } {
  if (!usage || usage.ai_minutes_limit === 0) {
    return { label: 'Bring your own phone', lowAlert: false };
  }
  const remaining = Math.max(0, usage.ai_minutes_limit - Math.round(usage.ai_minutes_used));
  if (remaining < 20) {
    return { label: `${remaining} min left`, lowAlert: true };
  }
  return { label: `${usage.ai_minutes_limit} min included`, lowAlert: false };
}

function Badge({ label, lowAlert }: { label: string; lowAlert: boolean }) {
  return (
    <span
      className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
        lowAlert
          ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
          : 'bg-surface-container-high/80 border-card-border text-on-surface-variant'
      }`}
    >
      {label}
    </span>
  );
}

export default function OutreachTools({ usage }: Props) {
  const badge = minutesBadge(usage);

  return (
    <div>
      <h3 className="font-headline text-lg font-bold text-on-surface mb-3">Outreach Tools</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <a
          href="/setup-number"
          className="relative block rounded-2xl border border-card-border hover:border-orange-500/40 bg-card shadow-lg hover:shadow-xl transition-all group p-5"
        >
          <Badge label={badge.label} lowAlert={badge.lowAlert} />
          <div className="w-11 h-11 rounded-xl bg-orange-500/15 flex items-center justify-center mb-3 group-hover:bg-orange-500/25 transition-colors">
            <MaterialIcon icon="phone_in_talk" className="text-[24px] text-orange-400" />
          </div>
          <h4 className="font-headline text-base font-bold text-on-surface group-hover:text-orange-400 transition-colors">
            Dialer
          </h4>
          <p className="text-xs text-secondary mt-1">Call prospects directly from the map</p>
        </a>

        <a
          href="/map?openAi=1"
          className="relative block rounded-2xl border border-card-border hover:border-violet-500/40 bg-card shadow-lg hover:shadow-xl transition-all group p-5"
        >
          <Badge label={badge.label} lowAlert={badge.lowAlert} />
          <div className="w-11 h-11 rounded-xl bg-violet-500/15 flex items-center justify-center mb-3 group-hover:bg-violet-500/25 transition-colors">
            <MaterialIcon icon="smart_toy" className="text-[24px] text-violet-400" />
          </div>
          <h4 className="font-headline text-base font-bold text-on-surface group-hover:text-violet-400 transition-colors">
            AI Assistant
          </h4>
          <p className="text-xs text-secondary mt-1">Handle inbound calls or assist with outreach</p>
        </a>

        <a
          href="/campaigns"
          className="relative block rounded-2xl border border-card-border hover:border-emerald-500/40 bg-card shadow-lg hover:shadow-xl transition-all group p-5"
        >
          <div className="w-11 h-11 rounded-xl bg-emerald-500/15 flex items-center justify-center mb-3 group-hover:bg-emerald-500/25 transition-colors">
            <MaterialIcon icon="campaign" className="text-[24px] text-emerald-400" />
          </div>
          <h4 className="font-headline text-base font-bold text-on-surface group-hover:text-emerald-400 transition-colors">
            Campaigns
          </h4>
          <p className="text-xs text-secondary mt-1">Email, text, and mail outreach at scale</p>
        </a>
      </div>
    </div>
  );
}
