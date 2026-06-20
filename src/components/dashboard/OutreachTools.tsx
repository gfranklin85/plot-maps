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
  /** The card's identity color (hex) — drives the icon, glow, accents. */
  accent: string;
  title: string;
  subtitle: string;
  bullets: string[];
  badge?: { label: string; lowAlert: boolean };
}

function ToolCard({ href, icon, accent, title, subtitle, bullets, badge, index = 0 }: CardProps & { index?: number }) {
  return (
    <motion.a
      href={href}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.08, ease: [0.2, 0.7, 0.2, 1] }}
      whileHover={{ y: -4 }}
      className="group relative flex flex-col rounded-2xl p-5 overflow-hidden transition-all duration-300"
      style={{
        // A glass object sitting ON the desk: dark gradient body, inset
        // top highlight (light catching the upper edge), and a drop shadow
        // that grounds it on the surface. No flat fill.
        background:
          'linear-gradient(160deg, rgba(34,44,68,0.92), rgba(13,20,36,0.96))',
        border: '1px solid rgba(125,168,255,0.16)',
        boxShadow:
          '0 18px 40px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(180,210,255,0.14)',
      }}
    >
      {/* accent glow that warms on hover — the card's identity light */}
      <div
        className="absolute -inset-px rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{
          background: `radial-gradient(80% 60% at 50% 0%, ${accent}22, transparent 70%)`,
        }}
      />

      {badge && (
        <span
          className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border"
          style={
            badge.lowAlert
              ? { background: 'rgba(255,178,74,0.15)', borderColor: 'rgba(255,178,74,0.4)', color: '#ffd24a' }
              : { background: 'rgba(125,168,255,0.1)', borderColor: 'rgba(125,168,255,0.25)', color: 'rgba(180,200,255,0.8)' }
          }
        >
          {badge.label}
        </span>
      )}

      <div className="relative flex flex-col">
        {/* icon chip — lit, raised */}
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 transition-transform group-hover:scale-110"
          style={{
            background: `linear-gradient(160deg, ${accent}33, ${accent}14)`,
            border: `1px solid ${accent}44`,
            boxShadow: `0 6px 16px -6px ${accent}66, inset 0 1px 0 rgba(255,255,255,0.12)`,
          }}
        >
          <span style={{ color: accent }}>
            <MaterialIcon icon={icon} className="text-[24px]" />
          </span>
        </div>

        <h4 className="font-headline text-base font-bold text-white">{title}</h4>
        <p className="text-xs text-[rgba(190,205,240,0.6)] mt-1">{subtitle}</p>

        <ul className="mt-3 space-y-1.5 text-[11px] text-[rgba(200,215,255,0.62)] leading-snug">
          {bullets.map((b, i) => (
            <li key={i} className="flex items-start gap-1.5">
              <span style={{ color: `${accent}cc` }} className="mt-0.5 shrink-0">
                <MaterialIcon icon="check" className="text-[13px]" />
              </span>
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
      <h3 className="font-headline text-lg font-bold text-white mb-4">What do you want to do?</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <ToolCard
          index={0}
          href="/imports"
          icon="upload_file"
          accent="#4ab6ff"
          title="Import Inventory"
          subtitle="Load listings, leads, and reference data"
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
          accent="#3d7bff"
          title="Open the Map"
          subtitle="Walk your market from overhead"
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
          accent="#5ed6a8"
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
          index={3}
          href="/ai-assistant"
          icon="smart_toy"
          accent="#b69dff"
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
