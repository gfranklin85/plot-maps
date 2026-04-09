'use client';

interface Props {
  current: number;
  total: number;
  phase: 'importing' | 'geocoding' | 'processing';
  label?: string;
}

export default function ImportProgress({ current, total, phase, label }: Props) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;

  const phaseConfig = {
    importing: { color: 'from-blue-500 to-indigo-600', icon: 'cloud_upload', text: 'Importing records...' },
    geocoding: { color: 'from-emerald-500 to-teal-600', icon: 'location_on', text: 'Geocoding addresses...' },
    processing: { color: 'from-violet-500 to-purple-600', icon: 'auto_awesome', text: 'Processing data...' },
  };

  const config = phaseConfig[phase];

  return (
    <div className="rounded-2xl bg-gradient-to-br from-surface-container to-surface-container-high p-6 text-on-surface overflow-hidden relative">
      {/* Animated background dots */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 bg-white/10 rounded-full animate-pulse"
            style={{
              left: `${(i * 8.3) % 100}%`,
              top: `${(i * 13.7) % 100}%`,
              animationDelay: `${i * 0.2}s`,
              animationDuration: `${1.5 + (i % 3) * 0.5}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px] animate-pulse">{config.icon}</span>
          </div>
          <div>
            <p className="text-sm font-bold">{label || config.text}</p>
            <p className="text-xs text-white/60">{current} of {total} {phase === 'geocoding' ? 'addresses' : 'records'}</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-2xl font-extrabold font-headline">{percent}%</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-3 w-full bg-white/10 rounded-full overflow-hidden">
          <div
            className={`h-full bg-gradient-to-r ${config.color} rounded-full transition-all duration-500 ease-out relative`}
            style={{ width: `${percent}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_2s_infinite]" />
          </div>
        </div>

        {/* Stats row */}
        <div className="flex items-center justify-between mt-3 text-xs text-white/50">
          <span>{current} completed</span>
          <span>{total - current} remaining</span>
        </div>
      </div>

      <style jsx>{`
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
