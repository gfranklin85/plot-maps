'use client';

// SidebarPropertyCard — the light, tabbed property card docked in the map
// sidebar. Driven by the SAME resolver as PropertyPopup (/api/parcel,
// /api/google-poi, /api/addresses → ResolvedProperty + Lead fields). Light
// theme to match the finished map UI. Tabs: Overview / Details / Owner — ONLY
// the ones with real data (Comps/Notes omitted until wired).
// See memory/project_map_page_finished_sidebar.

import { useEffect, useState } from 'react';
import { Lead } from '@/types';
import type { ResolvedProperty } from '@/lib/property-data/types';
import MaterialIcon from '@/components/ui/MaterialIcon';

type Tab = 'overview' | 'details' | 'owner';

const fmtNum = (n: number | null | undefined) => (n != null ? n.toLocaleString() : '—');
const dash = (v: unknown) => (v != null && v !== '' ? String(v) : '—');

export default function SidebarPropertyCard({ lead, onClose }: { lead: Lead; onClose?: () => void }) {
  const [parcel, setParcel] = useState<ResolvedProperty | null>(null);
  const [googlePoi, setGooglePoi] = useState<{ name: string | null; address: string | null } | null>(null);
  const [addressRecord, setAddressRecord] = useState<{ fullAddress: string } | null>(null);
  const [tab, setTab] = useState<Tab>('overview');

  // Same resolver pattern as PropertyPopup.
  useEffect(() => {
    let cancelled = false;
    setParcel(null); setGooglePoi(null); setAddressRecord(null); setTab('overview');
    const id = lead.id ?? '';
    if (id.startsWith('addr:')) {
      fetch(`/api/addresses/${encodeURIComponent(id.slice(5))}`)
        .then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setAddressRecord(d); }).catch(() => {});
      return () => { cancelled = true; };
    }
    if (id.startsWith('gpoi:')) {
      fetch(`/api/google-poi?placeId=${encodeURIComponent(id.slice(5))}`)
        .then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setGooglePoi(d); }).catch(() => {});
      return () => { cancelled = true; };
    }
    const apn = id.startsWith('parcel:') ? id.slice(7) : null;
    const url = apn
      ? `/api/parcel?apn=${encodeURIComponent(apn)}`
      : (lead.latitude != null && lead.longitude != null ? `/api/parcel?lat=${lead.latitude}&lng=${lead.longitude}` : null);
    if (!url) return;
    fetch(url).then((r) => (r.ok ? r.json() : null)).then((d) => { if (!cancelled && d) setParcel(d); }).catch(() => {});
    return () => { cancelled = true; };
  }, [lead.id, lead.latitude, lead.longitude]);

  // Resolved fields (lead first, then parcel/poi/address).
  const fullAddr = lead.property_address || parcel?.address || addressRecord?.fullAddress || googlePoi?.address || '';
  const street = fullAddr.split(',')[0]?.trim() || (googlePoi?.name ?? 'Unknown address');
  const cityLine = [lead.city, lead.state].filter(Boolean).join(', ') + (lead.zip ? ` ${lead.zip}` : '')
    || fullAddr.split(',').slice(1).join(',').trim();

  const status = lead.listing_status as 'Active' | 'Pending' | 'Sold' | null | undefined;
  const isListed = !!status;
  const beds = lead.bedrooms ?? (typeof parcel?.bedrooms === 'number' ? parcel.bedrooms : null);
  const baths = lead.bathrooms ?? (typeof parcel?.bathrooms === 'number' ? parcel.bathrooms : null);
  const sqft = lead.sqft ?? parcel?.buildingSize ?? null;
  const acres = lead.lot_acres ?? parcel?.acres ?? null;
  const built = lead.year_built ?? parcel?.yearBuilt ?? null;
  const apn = parcel?.apn ?? null;
  const propType = parcel?.buildingType || (isListed ? 'Residential' : (parcel?.use2024 ?? null));
  const zoning = parcel?.zoningCode ?? null;
  const photo = lead.listing_photo_url || (lead.listing_photo_urls?.[0] ?? null);

  // Last sale — only real data; never an estimate (no-gimmick rule).
  const lastSale = lead.selling_price && lead.selling_date
    ? `$${lead.selling_price.toLocaleString()} · ${new Date(lead.selling_date).getFullYear()}`
    : null;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'details', label: 'Details' },
    { key: 'owner', label: 'Owner' },
  ];

  return (
    <div className="sb-card">
      {/* hero */}
      <div className="sb-card__hero">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo} alt="" className="sb-card__photo" />
        ) : (
          <div className="sb-card__photo sb-card__photo--empty"><MaterialIcon icon="home" /></div>
        )}
        <span className="sb-card__badge">{isListed ? status : 'Off Market'}</span>
        {onClose && (
          <button className="sb-card__close" onClick={onClose} aria-label="Close"><MaterialIcon icon="close" /></button>
        )}
      </div>

      {/* address + type */}
      <div className="sb-card__head">
        <div>
          <div className="sb-card__street">{street}</div>
          <div className="sb-card__city">{cityLine}</div>
        </div>
        {propType && <span className="sb-card__type"><MaterialIcon icon="villa" className="text-[13px]" /> {propType}</span>}
      </div>

      {/* quick facts */}
      <div className="sb-card__facts">
        <div><div className="sb-card__factk">APN</div><div className="sb-card__factv">{dash(apn)}</div></div>
        <div><div className="sb-card__factk">Lot Size</div><div className="sb-card__factv">{acres != null ? `${(acres * 43560).toLocaleString(undefined, { maximumFractionDigits: 0 })} sq ft` : '—'}</div></div>
        <div><div className="sb-card__factk">Zoning</div><div className="sb-card__factv">{dash(zoning)}</div></div>
      </div>

      {/* tabs */}
      <div className="sb-card__tabs">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`sb-card__tab ${tab === t.key ? 'is-active' : ''}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* tab body */}
      <div className="sb-card__body">
        {tab === 'overview' && (
          <Rows rows={[
            ['Property Type', dash(propType)],
            ['Year Built', dash(built)],
            ['Bedrooms / Bathrooms', beds != null || baths != null ? `${dash(beds)} / ${dash(baths)}` : '—'],
            ['Building Size', sqft != null ? `${fmtNum(sqft)} sq ft` : '—'],
            ['Lot Size', acres != null ? `${acres} acres` : '—'],
            ...(lastSale ? [['Last Sale', lastSale] as [string, string]] : []),
          ]} />
        )}
        {tab === 'details' && (
          <Rows rows={([
            ['Zoning', parcel?.zoningDesc ? `${dash(zoning)} · ${parcel.zoningDesc}` : dash(zoning)],
            ['General Plan', dash(parcel?.generalPlanDesc ?? parcel?.generalPlanCode)],
            ['Use', dash(parcel?.use2024)],
            ['Construction', dash(parcel?.construction)],
            ['Roof', dash(parcel?.roofCover)],
            ['Water', dash(parcel?.waterSource)],
            ['Heating', dash(parcel?.heating)],
            ['Garage', dash(parcel?.garage)],
          ] as [string, string][]).filter((r) => r[1] !== '—')} emptyNote="No additional public-record details available." />
        )}
        {tab === 'owner' && (
          <Rows rows={([
            ['Owner', dash(lead.owner_name ?? parcel?.assesseeName)],
            ['Mailing', dash([parcel?.mailingAddress1, parcel?.mailingAddress2].filter(Boolean).join(' ') || lead.mailing_address)],
            ['Phone', dash(lead.phone)],
            ['Email', dash(lead.email)],
          ] as [string, string][]).filter((r) => r[1] !== '—')} emptyNote="Owner details appear after skip-trace or from public records." />
        )}
      </div>

      {/* action row */}
      <div className="sb-card__actions">
        <SbAction icon="bookmark_border" label="Save" />
        <SbAction icon="playlist_add" label="Add to list" />
        <SbAction icon="person" label="Owner" onClick={() => setTab('owner')} />
        <SbAction icon="description" label="Details" onClick={() => setTab('details')} />
      </div>

      <button className="sb-card__full">View full details <MaterialIcon icon="arrow_forward" className="text-[16px]" /></button>
    </div>
  );
}

function Rows({ rows, emptyNote }: { rows: [string, string][]; emptyNote?: string }) {
  if (rows.length === 0) return <p className="sb-card__empty">{emptyNote ?? 'Nothing here yet.'}</p>;
  return (
    <div className="sb-card__rows">
      {rows.map(([k, v]) => (
        <div key={k} className="sb-card__row"><span>{k}</span><b>{v}</b></div>
      ))}
    </div>
  );
}

function SbAction({ icon, label, onClick }: { icon: string; label: string; onClick?: () => void }) {
  return (
    <button className="sb-card__act" onClick={onClick}>
      <MaterialIcon icon={icon} className="text-[19px]" />
      <span>{label}</span>
    </button>
  );
}
