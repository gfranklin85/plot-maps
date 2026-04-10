'use client';

import Link from 'next/link';
import MaterialIcon from './MaterialIcon';

interface FeatureConfig {
  title: string;
  icon: string;
  description: string;
  bullets: [string, string, string];
  dismiss: string;
}

const FEATURES: Record<string, FeatureConfig> = {
  walkMode: {
    title: 'Unlock Walk Mode',
    icon: 'streetview',
    description: 'Virtually walk neighborhoods and identify opportunities at street level.',
    bullets: ['Street View Integration', 'Real-time Property Interaction', 'Neighborhood-level Prospecting'],
    dismiss: 'Return to Standard Map',
  },
  ai: {
    title: 'Let AI Power Your Workflow',
    icon: 'auto_awesome',
    description: 'Generate action lists, call guidance, and email drafts with one click.',
    bullets: ['AI-Prioritized Lead Lists', 'Smart Call Scripts', 'One-Click Email Drafts'],
    dismiss: 'Continue without AI',
  },
  smartImport: {
    title: 'Stop Mapping Columns Manually',
    icon: 'auto_awesome',
    description: 'Let AI parse messy MLS snippets, unstructured text, or scattered lists.',
    bullets: ['Zero Mapping Required', 'Instant Data Enrichment', 'Clean & Validated Records'],
    dismiss: 'Continue with manual import',
  },
  email: {
    title: 'Let AI Draft Your Outreach',
    icon: 'mail',
    description: 'Generate personalized emails based on property data and owner history.',
    bullets: ['Data-Driven Personalization', 'Contextual Property Insights', 'One-Click Send'],
    dismiss: 'Continue with manual draft',
  },
  dialer: {
    title: 'Power Dialer Included',
    icon: 'phone_in_talk',
    description: 'Call owners directly from the map with one click. See the property while you talk.',
    bullets: ['One-Click Calling from Map & Walk Mode', 'Call Logging & Outcome Tracking', 'Your Own Dedicated Phone Number'],
    dismiss: 'Maybe later',
  },
  marketData: {
    title: 'Unlock Full Market Data',
    icon: 'analytics',
    description: 'See pricing, sale history, and property details for every listing in your market.',
    bullets: ['Sold Prices & Days on Market', 'Price-per-Sqft Comps', 'Complete Property Details'],
    dismiss: 'Continue with limited view',
  },
  autoTarget: {
    title: 'Find Prospects Nearby',
    icon: 'my_location',
    description: 'One-click prospect lists around any reference property. Addresses + phone numbers, ready to dial.',
    bullets: ['One-Click Prospect Discovery', 'Addresses + Phone Numbers', 'Ready-to-Dial Lists'],
    dismiss: 'Maybe later',
  },
};

interface Props {
  feature: keyof typeof FEATURES;
  onClose: () => void;
  show: boolean;
}

export default function UpgradeGate({ feature, onClose, show }: Props) {
  if (!show) return null;

  const config = FEATURES[feature];
  if (!config) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-card/90 backdrop-blur-xl rounded-2xl border border-primary/20 shadow-2xl shadow-primary/30 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-primary/10 rounded-full blur-[40px]" />

        <div className="relative z-10 p-8 md:p-10 text-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-secondary hover:text-on-surface-variant transition-colors"
          >
            <MaterialIcon icon="close" className="text-[20px]" />
          </button>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full border border-primary/30 mb-6">
            <MaterialIcon icon="diamond" className="text-[14px] text-primary" />
            <span className="text-primary text-[10px] font-black uppercase tracking-[0.2em]">Premium Feature</span>
          </div>

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary/20 rounded-2xl mb-6 border border-primary/30">
            <MaterialIcon icon={config.icon} className="text-[32px] text-primary" />
          </div>

          {/* Title + Description */}
          <h2 className="text-3xl font-extrabold text-on-surface mb-3 tracking-tight font-headline">
            {config.title}
          </h2>
          <p className="text-on-surface-variant text-base leading-relaxed mb-8 max-w-md mx-auto">
            {config.description}
          </p>

          {/* Feature bullets */}
          <div className="bg-surface/60 rounded-xl p-5 mb-8 text-left border border-card-border space-y-4">
            {config.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-primary/30 flex items-center justify-center">
                  <MaterialIcon icon="check" className="text-[12px] text-primary" />
                </div>
                <span className="text-sm font-semibold text-on-surface">{bullet}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/subscribe"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-primary/80 to-primary text-white py-4 rounded-xl font-bold text-lg shadow-[0_10px_25px_-5px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Upgrade — $49/mo
            <MaterialIcon icon="bolt" className="text-[20px]" />
          </Link>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="mt-4 text-secondary hover:text-on-surface-variant text-sm font-medium transition-colors"
          >
            {config.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
