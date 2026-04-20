'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';
import InfoTooltip from './InfoTooltip';

interface FunnelStep {
  key: 'visitors' | 'multiPage' | 'signedUp' | 'subscribed';
  label: string;
  count: number;
  hint: string;
}

interface Props {
  visitors: number;
  multiPage: number;
  signedUp: number;
  subscribed: number;
  activeStep?: FunnelStep['key'] | null;
  onStepClick?: (step: FunnelStep['key']) => void;
}

export default function FunnelCard({ visitors, multiPage, signedUp, subscribed, activeStep, onStepClick }: Props) {
  const steps: FunnelStep[] = [
    { key: 'visitors', label: 'Visitors', count: visitors, hint: 'Every unique anonymous session.' },
    { key: 'multiPage', label: '3+ Pages', count: multiPage, hint: 'Visitors who viewed 3 or more pages — an engagement signal.' },
    { key: 'signedUp', label: 'Signed Up', count: signedUp, hint: 'Sessions that reached the signup/conversion event.' },
    { key: 'subscribed', label: 'Subscribed', count: subscribed, hint: 'Users with an active paid subscription.' },
  ];

  const max = Math.max(visitors, 1);

  return (
    <div className="rounded-2xl border border-outline-variant bg-surface-container-low p-6">
      <h2 className="text-base font-semibold text-on-surface mb-1 flex items-center gap-2">
        <MaterialIcon icon="filter_alt" className="text-primary text-lg" />
        Conversion Funnel
        <InfoTooltip text="How visitors progress from landing on the site to becoming paying subscribers. Click a step to filter the Hot Prospects table." />
      </h2>
      <p className="text-xs text-on-surface-variant mb-4">Click a step to filter the prospects table below.</p>

      <div className="space-y-3">
        {steps.map((step, i) => {
          const pct = Math.round((step.count / max) * 100);
          const prev = i > 0 ? steps[i - 1].count : step.count;
          const dropOffPct = prev > 0 ? Math.round(((prev - step.count) / prev) * 100) : 0;
          const isActive = activeStep === step.key;
          const clickable = !!onStepClick;

          return (
            <div key={step.key} className="space-y-1">
              {i > 0 && (
                <p className="text-[10px] text-on-surface-variant pl-28 uppercase tracking-wider">
                  {dropOffPct >= 0 ? `${dropOffPct}% drop-off` : `${Math.abs(dropOffPct)}% gain`}
                </p>
              )}
              <button
                type="button"
                disabled={!clickable}
                onClick={() => clickable && onStepClick?.(step.key)}
                className={`w-full flex items-center gap-3 group ${clickable ? 'cursor-pointer' : 'cursor-default'}`}
                title={step.hint}
              >
                <span className={`w-24 text-xs text-right shrink-0 ${isActive ? 'text-primary font-semibold' : 'text-on-surface-variant'}`}>
                  {step.label}
                </span>
                <div className={`flex-1 h-8 rounded-lg overflow-hidden relative border transition-all ${
                  isActive ? 'border-primary bg-primary/10' : 'border-transparent bg-surface-container'
                } ${clickable ? 'group-hover:border-primary/60' : ''}`}>
                  <div
                    className={`h-full rounded-lg transition-all ${isActive ? 'bg-primary/70' : 'bg-primary/50'}`}
                    style={{ width: `${Math.max(pct, 2)}%` }}
                  />
                  <span className="absolute inset-0 flex items-center px-3 text-xs font-semibold text-on-surface">
                    {step.count.toLocaleString()} <span className="text-on-surface-variant ml-1.5">({pct}%)</span>
                  </span>
                </div>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
