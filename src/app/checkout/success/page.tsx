'use client';

import Link from 'next/link';
import MaterialIcon from '@/components/ui/MaterialIcon';

export default function CheckoutSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-surface-container-low to-primary/10 flex items-center justify-center p-8">
      <div className="max-w-lg w-full bg-card rounded-2xl shadow-xl p-10 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100">
          <MaterialIcon icon="check_circle" className="text-[48px] text-emerald-500" />
        </div>

        <h1 className="text-2xl font-extrabold text-on-surface font-headline mt-4">
          Welcome to Plot Maps!
        </h1>
        <p className="text-secondary mt-3">
          Your subscription is active. Start importing your property lists and see them come alive on the map.
        </p>

        <Link
          href="/map"
          className="inline-flex items-center gap-2 mt-8 action-gradient text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow"
        >
          <MaterialIcon icon="map" className="text-[20px]" />
          Go to Your Map
        </Link>

        <p className="mt-4">
          <Link href="/settings" className="text-sm text-primary hover:underline">
            View Settings
          </Link>
        </p>
      </div>
    </div>
  );
}
