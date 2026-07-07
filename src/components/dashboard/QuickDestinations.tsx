'use client';

// ── QuickDestinations ─────────────────────────────────────────────────
//
// The dashboard launchpad: a search bar to jump ANYWHERE (market, street,
// house, neighborhood) + the user's saved quick-destination chips. Search a
// place → fly there; tap the + to save the current search as a chip for
// one-tap access next time. Supabase-backed (synced across devices), scoped to
// the user via RLS (saved_destinations). No stars/icons — a plain +.
//
// Latency: this is a search input + a small DB list — NOT a live map. The
// heavy Map3D only spins up when the user actually flies somewhere. Keeps the
// dashboard instant. memory/project_desk_surface_backout_ui

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface SavedDestination {
  id: string;
  label: string;
  lat: number;
  lng: number;
  sort_order: number;
}

export default function QuickDestinations() {
  const router = useRouter();
  const { user } = useAuth();
  const [saved, setSaved] = useState<SavedDestination[]>([]);
  // The most-recent search selection — offered as "+ Save" until saved.
  const [pending, setPending] = useState<{ label: string; lat: number; lng: number } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_destinations')
      .select('id, label, lat, lng, sort_order')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    setSaved((data as SavedDestination[]) ?? []);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const flyTo = (lat: number, lng: number) =>
    router.push(`/map?lat=${lat}&lng=${lng}&view=3d`);

  const savePending = async () => {
    if (!user || !pending) return;
    // Already saved? Don't duplicate.
    const dup = saved.some(
      (s) => Math.abs(s.lat - pending.lat) < 1e-5 && Math.abs(s.lng - pending.lng) < 1e-5,
    );
    if (dup) { setPending(null); return; }
    const { data } = await supabase
      .from('saved_destinations')
      .insert({
        user_id: user.id,
        label: pending.label,
        lat: pending.lat,
        lng: pending.lng,
        sort_order: saved.length,
      })
      .select('id, label, lat, lng, sort_order')
      .single();
    if (data) setSaved((prev) => [...prev, data as SavedDestination]);
    setPending(null);
  };

  const remove = async (id: string) => {
    setSaved((prev) => prev.filter((s) => s.id !== id));
    await supabase.from('saved_destinations').delete().eq('id', id);
  };

  return (
    <div className="qd">
      <div className="qd__label">Jump to any market, street, or neighborhood</div>
      <div className="qd__bar">
        <ProspectSearch
          compact
          placeholder="Search a market, address, or place"
          onSelect={({ lat, lng, address }) => {
            setPending({ label: address || 'Saved place', lat, lng });
            flyTo(lat, lng);
          }}
        />
      </div>

      {/* pending save prompt — appears right after a search selection */}
      {pending && (
        <button className="qd__save" onClick={savePending}>
          <MaterialIcon icon="add" className="text-[16px]" />
          Save “{pending.label.split(',')[0]}” to quick destinations
        </button>
      )}

      {/* saved chips */}
      <div className="qd__chips">
        {saved.map((s) => (
          <span key={s.id} className="qd__chip">
            <button className="qd__chip-go" onClick={() => flyTo(s.lat, s.lng)} title={`Fly to ${s.label}`}>
              <MaterialIcon icon="near_me" className="text-[13px]" />
              {s.label.split(',')[0]}
            </button>
            <button className="qd__chip-x" onClick={() => remove(s.id)} aria-label={`Remove ${s.label}`}>
              <MaterialIcon icon="close" className="text-[13px]" />
            </button>
          </span>
        ))}
        {saved.length === 0 && !pending && (
          <span className="qd__empty">Search a place above, then <b>+ save</b> it here for one-tap flying.</span>
        )}
      </div>
    </div>
  );
}
