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
  nearbyPlaces: {
    title: 'See the Neighborhood Like a Pro',
    icon: 'location_on',
    description: 'Discover schools, grocery stores, and amenities near any property.',
    bullets: ['Schools & Shopping', 'Transit & Services', 'Walkability Scores'],
    dismiss: 'Skip for now',
  },
  aerial: {
    title: 'Aerial Flyover Locked',
    icon: 'flight',
    description: 'View cinematic aerial tours of any property.',
    bullets: ['4K Drone Footage', '360° Property Views', 'Neighborhood Context'],
    dismiss: 'Skip for now',
  },
  driveTime: {
    title: 'Unlock Drive Time Analysis',
    icon: 'timer',
    description: 'Calculate precise travel times to key locations using real-time traffic.',
    bullets: ['Real-Time Traffic Data', 'Multi-Destination Routes', 'Commute Scoring'],
    dismiss: 'Skip for now',
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
      <div className="absolute inset-0 bg-[#0c1324]/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-xl bg-[#151b2d]/90 backdrop-blur-xl rounded-2xl border border-indigo-500/20 shadow-2xl shadow-indigo-900/30 overflow-hidden">
        {/* Ambient glow */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-600/20 rounded-full blur-[80px]" />
        <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-indigo-400/10 rounded-full blur-[40px]" />

        <div className="relative z-10 p-8 md:p-10 text-center">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-slate-500 hover:text-slate-300 transition-colors"
          >
            <MaterialIcon icon="close" className="text-[20px]" />
          </button>

          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/30 mb-6">
            <MaterialIcon icon="diamond" className="text-[14px] text-indigo-400" />
            <span className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em]">Premium Feature</span>
          </div>

          {/* Icon */}
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-500/20 rounded-2xl mb-6 border border-indigo-500/30">
            <MaterialIcon icon={config.icon} className="text-[32px] text-indigo-400" />
          </div>

          {/* Title + Description */}
          <h2 className="text-3xl font-extrabold text-white mb-3 tracking-tight font-headline">
            {config.title}
          </h2>
          <p className="text-slate-400 text-base leading-relaxed mb-8 max-w-md mx-auto">
            {config.description}
          </p>

          {/* Feature bullets */}
          <div className="bg-[#0c1324]/60 rounded-xl p-5 mb-8 text-left border border-white/5 space-y-4">
            {config.bullets.map((bullet) => (
              <div key={bullet} className="flex items-start gap-3">
                <div className="mt-0.5 flex-shrink-0 w-5 h-5 rounded-full bg-indigo-500/30 flex items-center justify-center">
                  <MaterialIcon icon="check" className="text-[12px] text-indigo-400" />
                </div>
                <span className="text-sm font-semibold text-slate-200">{bullet}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <Link
            href="/subscribe"
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-br from-indigo-400 to-indigo-600 text-white py-4 rounded-xl font-bold text-lg shadow-[0_10px_25px_-5px_rgba(79,70,229,0.4)] hover:opacity-90 active:scale-[0.98] transition-all"
          >
            Upgrade — $49/mo
            <MaterialIcon icon="bolt" className="text-[20px]" />
          </Link>

          {/* Dismiss */}
          <button
            onClick={onClose}
            className="mt-4 text-slate-500 hover:text-slate-300 text-sm font-medium transition-colors"
          >
            {config.dismiss}
          </button>
        </div>
      </div>
    </div>
  );
}
