'use client';

import { motion } from 'framer-motion';
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
  image?: string;
}

function ToolCard({ href, icon, iconTint, hoverBorder, hoverText, title, subtitle, bullets, badge, image, index = 0 }: CardProps & { index?: number }) {
  return (
    <motion.a
      href={href}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -3 }}
      className={`paper-texture blueprint-grid relative flex flex-col rounded-2xl border border-card-border bg-card shadow-paper-md hover:shadow-paper-lg transition-shadow group p-5 overflow-hidden ${hoverBorder}`}
      style={{ ['--grid-opacity' as string]: '0.035' }}
    >
      {image && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-[0.06] group-hover:opacity-[0.12] transition-opacity"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-card via-card/90 to-card/60" />
        </>
      )}

      {badge && (
        <span
          className={`absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${
            badge.lowAlert
              ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
              : 'bg-surface-container-high/80 border-card-border text-on-surface-variant'
          }`}
        >
          {badge.label}
        </span>
      )}

      <div className="relative flex flex-col">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110 ${iconTint}`}>
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
      </div>
    </motion.a>
  );
}

export default function OutreachTools({ usage }: Props) {
  const badge = minutesBadge(usage);

  return (
    <div>
      <h3 className="font-headline text-lg font-bold text-on-surface mb-3">What do you want to do?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ToolCard
          index={0}
          href="/imports"
          icon="upload_file"
          iconTint="bg-status-cold/20 text-status-cold/90 group-hover:bg-status-cold/30"
          hoverBorder="hover:border-status-cold/50"
          hoverText="group-hover:text-status-cold"
          title="Import Inventory"
          subtitle="Load listings, leads, and reference data"
          image="/card-mls.png"
          bullets={[
            'Drop a CSV or paste from MLS',
            'Auto-detects addresses, owners, phones',
            'Populates context for every prospect call',
          ]}
        />
        <ToolCard
          index={1}
          href="/map"
          icon="map"
          iconTint="bg-primary/15 text-primary group-hover:bg-primary/25"
          hoverBorder="hover:border-primary/40"
          hoverText="group-hover:text-primary"
          title="Open the Map"
          subtitle="Walk your market from overhead"
          image="/card-map.png"
          bullets={[
            'See every listing, sale, and prospect',
            'Click homes to select and skiptrace',
            'Filter by status, price, or tags',
          ]}
        />
        <ToolCard
          index={2}
          href="/setup-number"
          icon="phone_in_talk"
          iconTint="bg-stake/15 text-stake group-hover:bg-stake/25"
          hoverBorder="hover:border-stake/40"
          hoverText="group-hover:text-stake"
          title="Dialer"
          subtitle="Call directly from the map"
          image="/card-dialer.png"
          bullets={[
            'Get a local phone number',
            'One-click dial from any property',
            'Notes and outcomes auto-logged',
          ]}
          badge={badge}
        />
        <ToolCard
          index={3}
          href="/ai-assistant"
          icon="smart_toy"
          iconTint="bg-blueprint/15 text-blueprint group-hover:bg-blueprint/25"
          hoverBorder="hover:border-blueprint/40"
          hoverText="group-hover:text-blueprint"
          title="AI Receptionist"
          subtitle="Answers inbound calls — never cold outbound"
          image="/card-leads.png"
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
