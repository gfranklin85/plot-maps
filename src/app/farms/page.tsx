'use client';

// ── /farms — draw & manage territories (the assigner tool) ────────────
//
// Draw a farm boundary on a 2D aerial overhead map: click points around an
// area (e.g. "The Wood Streets"), name it, save it. Territories are the areas
// missions (PlotSets) get built on. Overhead 2D is the right surface for
// precise boundary-drawing (no perspective to fight). memory/the_thesis
// (PlotSets = assigned missions over assigner-defined territories).

import { useEffect, useRef, useState, useCallback } from 'react';
import { APIProvider, Map, useMap } from '@vis.gl/react-google-maps';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { GOOGLE_MAPS_API_KEY, GOOGLE_MAPS_LIBRARIES } from '@/lib/googleMapsConfig';

interface Territory { id: string; name: string; }

// Lemoore center — the first rollout market.
const LEMOORE = { lat: 36.3008, lng: -119.7829 };

export default function FarmsPage() {
  return (
    <div className="dsh min-h-screen">
      <div className="farms__wrap">
        <div className="dsh-intro__eyebrow">Your farms</div>
        <h1 className="farms__h">Draw a territory to farm.</h1>
        <p className="farms__sub">
          Click around an area on the aerial to draw its boundary — a section of
          streets, a neighborhood, anything you&apos;d name. Double-click or hit
          Finish to close it, give it a name, and save. Missions get built on it.
        </p>
        <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={GOOGLE_MAPS_LIBRARIES}>
          <FarmDrawer />
        </APIProvider>
      </div>
    </div>
  );
}

function FarmDrawer() {
  const map = useMap();
  const { user } = useAuth();
  const [drawing, setDrawing] = useState(false);
  const [points, setPoints] = useState<google.maps.LatLngLiteral[]>([]);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [territories, setTerritories] = useState<Territory[]>([]);
  const polyRef = useRef<google.maps.Polygon | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);

  const loadTerritories = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase.from('territories').select('id, name').order('created_at', { ascending: false });
    setTerritories((data as Territory[]) ?? []);
  }, [user]);

  useEffect(() => { loadTerritories(); }, [loadTerritories]);

  // Aerial overhead + click-to-add-point while drawing.
  useEffect(() => {
    if (!map) return;
    map.setMapTypeId('satellite');
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!drawing || !e.latLng) return;
      setPoints((prev) => [...prev, { lat: e.latLng!.lat(), lng: e.latLng!.lng() }]);
    });
    return () => google.maps.event.removeListener(listener);
  }, [map, drawing]);

  // Render the live polygon + point markers.
  useEffect(() => {
    if (!map) return;
    polyRef.current?.setMap(null);
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = [];
    if (points.length > 0) {
      polyRef.current = new google.maps.Polygon({
        paths: points, map,
        strokeColor: '#1349d4', strokeWeight: 2, fillColor: '#1349d4', fillOpacity: 0.18,
      });
      markersRef.current = points.map((p) => new google.maps.Marker({
        position: p, map,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 5, fillColor: '#fff', fillOpacity: 1, strokeColor: '#1349d4', strokeWeight: 2 },
      }));
    }
    return () => { polyRef.current?.setMap(null); markersRef.current.forEach((m) => m.setMap(null)); };
  }, [map, points]);

  const reset = () => { setPoints([]); setName(''); setDrawing(false); };

  const save = async () => {
    if (!user || points.length < 3 || !name.trim()) return;
    setSaving(true);
    const coords = points.map((p) => [p.lng, p.lat]); // [lng,lat] for PostGIS
    const { error } = await supabase.rpc('save_territory', { _name: name.trim(), _points: coords });
    setSaving(false);
    if (!error) { reset(); loadTerritories(); }
    else console.error('[farms] save failed', error.message);
  };

  return (
    <>
      <div className="farms__toolbar">
        {!drawing ? (
          <button className="farms__btn is-primary" onClick={() => { setPoints([]); setDrawing(true); }}>
            <MaterialIcon icon="draw" className="text-[18px]" /> Draw a new farm
          </button>
        ) : (
          <>
            <span className="farms__hint">
              {points.length < 3
                ? `Click the map to add corners (${points.length}/3 min)`
                : `${points.length} points — name it and save`}
            </span>
            <input
              className="farms__name"
              placeholder="Name this farm (e.g. The Wood Streets)"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <button className="farms__btn is-primary" disabled={points.length < 3 || !name.trim() || saving} onClick={save}>
              <MaterialIcon icon="check" className="text-[18px]" /> {saving ? 'Saving…' : 'Save farm'}
            </button>
            <button className="farms__btn" onClick={() => setPoints((p) => p.slice(0, -1))} disabled={!points.length}>
              <MaterialIcon icon="undo" className="text-[18px]" /> Undo point
            </button>
            <button className="farms__btn" onClick={reset}>Cancel</button>
          </>
        )}
      </div>

      <div className="farms__map">
        <Map
          defaultCenter={LEMOORE}
          defaultZoom={15}
          mapTypeId="satellite"
          disableDefaultUI={false}
          gestureHandling="greedy"
          clickableIcons={false}
          style={{ width: '100%', height: '100%' }}
        />
      </div>

      {territories.length > 0 && (
        <div className="farms__list">
          <div className="farms__list-h">Your farms</div>
          {territories.map((t) => (
            <span key={t.id} className="farms__chip"><MaterialIcon icon="crop_free" className="text-[14px]" /> {t.name}</span>
          ))}
        </div>
      )}
    </>
  );
}
