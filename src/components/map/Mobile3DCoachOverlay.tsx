'use client';

import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  onDismiss: () => void;
}

// First-load explainer for mobile users. The map auto-tilts on mobile,
// which is great UX-wise but disorienting if you've never seen it before.
// One short coach card teaches the gestures, dismisses on tap, never
// reappears (localStorage flag).
export default function Mobile3DCoachOverlay({ onDismiss }: Props) {
  return (
    <button
      type="button"
      onClick={onDismiss}
      className="fixed bottom-24 left-4 right-4 z-40 mx-auto max-w-md text-left bg-primary text-white rounded-2xl shadow-2xl border border-white/10 p-4 animate-in fade-in slide-in-from-bottom-4 duration-500"
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
          <MaterialIcon icon="3d_rotation" className="text-[20px]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold">You&apos;re in 3D view</p>
          <ul className="text-xs opacity-90 mt-1.5 space-y-1 leading-snug">
            <li className="flex items-center gap-2">
              <MaterialIcon icon="zoom_in" className="text-[13px] opacity-70" />
              Pinch to zoom &middot; drag to pan
            </li>
            <li className="flex items-center gap-2">
              <MaterialIcon icon="rotate_90_degrees_ccw" className="text-[13px] opacity-70" />
              Two fingers to rotate or tilt
            </li>
          </ul>
          <p className="text-[10px] opacity-70 mt-2 font-semibold uppercase tracking-wider">
            Tap to dismiss
          </p>
        </div>
        <MaterialIcon icon="close" className="text-[16px] opacity-70 shrink-0" />
      </div>
    </button>
  );
}
