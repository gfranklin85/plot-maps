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

interface CardProps {
  href: string;
  icon: string;
  iconTint: string;
  hoverBorder: string;
  hoverText: string;
  title: string;
  subtitle: string;
  bullets: string[];
  badge?: { label: string; lowAlert: boolean };
}

function ToolCard({ href, icon, iconTint, hoverBorder, hoverText, title, subtitle, bullets, badge }: CardProps) {
  return (
    <a
      href={href}
      className={`relative flex flex-col rounded-2xl border border-card-border bg-card shadow-lg hover:shadow-xl transition-all group p-5 ${hoverBorder}`}
    >
      {badge && (
        <span
          className={`absolute top-3 right-3 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
            badge.lowAlert
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-surface-container-high/80 border-card-border text-on-surface-variant'
          }`}
        >
          {badge.label}
        </span>
      )}

      <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 ${iconTint}`}>
        <MaterialIcon icon={icon} className="text-[24px]" />
      </div>

      <h4 className={`font-headline text-base font-bold text-on-surface transition-colors ${hoverText}`}>
        {title}
      </h4>
      <p className="text-xs text-secondary mt-1">{subtitle}</p>

      <ul className="mt-3 space-y-1.5 text-[11px] text-on-surface-variant leading-snug">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-1.5">
            <MaterialIcon icon="check" className="text-[13px] text-on-surface-variant/70 mt-0.5 shrink-0" />
            <span>{b}</span>
          </li>
        ))}
      </ul>
    </a>
  );
}

export default function OutreachTools({ usage }: Props) {
  const badge = minutesBadge(usage);

  return (
    <div>
      <h3 className="font-headline text-lg font-bold text-on-surface mb-3">What do you want to do?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ToolCard
          href="/imports"
          icon="upload_file"
          iconTint="bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25"
          hoverBorder="hover:border-emerald-500/40"
          hoverText="group-hover:text-emerald-400"
          title="Import Inventory"
          subtitle="Load listings, leads, and reference data"
          bullets={[
            'Drop a CSV or paste from MLS',
            'Auto-detects addresses, owners, phones',
            'Populates context for every prospect call',
          ]}
        />
        <ToolCard
          href="/map"
          icon="map"
          iconTint="bg-primary/15 text-primary group-hover:bg-primary/25"
          hoverBorder="hover:border-primary/40"
          hoverText="group-hover:text-primary"
          title="Open the Map"
          subtitle="Walk your market from overhead"
          bullets={[
            'See every listing, sale, and prospect',
            'Click homes to select and skiptrace',
            'Filter by status, price, or tags',
          ]}
        />
        <ToolCard
          href="/setup-number"
          icon="phone_in_talk"
          iconTint="bg-orange-500/15 text-orange-400 group-hover:bg-orange-500/25"
          hoverBorder="hover:border-orange-500/40"
          hoverText="group-hover:text-orange-400"
          title="Dialer"
          subtitle="Call directly from the map"
          bullets={[
            'Get a local phone number',
            'One-click dial from any property',
            'Notes and outcomes auto-logged',
          ]}
          badge={badge}
        />
        <ToolCard
          href="/ai-assistant"
          icon="smart_toy"
          iconTint="bg-violet-500/15 text-violet-400 group-hover:bg-violet-500/25"
          hoverBorder="hover:border-violet-500/40"
          hoverText="group-hover:text-violet-400"
          title="AI Receptionist"
          subtitle="Answers inbound calls — never cold outbound"
          bullets={[
            'Answers calls on your number when you miss them',
            'Qualifies and captures seller intent',
            'Follows up only with opted-in leads',
          ]}
          badge={badge}
        />
      </div>
    </div>
  );
}
