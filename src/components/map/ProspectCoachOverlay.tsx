'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  onDismiss: () => void;
}

export default function ProspectCoachOverlay({ onDismiss }: Props) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="fixed top-20 right-4 md:top-24 md:right-8 z-40 w-[260px] text-left bg-primary text-white rounded-2xl shadow-2xl border border-white/10 p-4 animate-in fade-in slide-in-from-top-2 duration-300"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <MaterialIcon icon="ads_click" className="text-[18px]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">Select nearby homes</p>
          <p className="text-xs opacity-90 mt-1 leading-snug">
            Click properties on the map. Then skiptrace and start calling.
          </p>
        </div>
        <MaterialIcon icon="close" className="text-[16px] opacity-70 shrink-0" />
      </div>
    </button>
  );
}
