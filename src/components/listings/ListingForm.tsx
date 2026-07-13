'use client';

// ── ListingForm — post a property listing (free) ──────────────────────
//
// Google Places autocomplete (ProspectSearch) → lat/lng, then we match the
// parcel APN from the coords (/api/parcels/at-point). Photos upload to the
// listing-photos bucket. Submit → POST /api/listings → /listings/<id>.
// memory/project_pin_grammar (Actives show on the map). Greg 2026-07-13.

import { useCallback, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProspectSearch from '@/components/dashboard/ProspectSearch';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { useProfile } from '@/lib/profile-context';

type Photo = { url: string; uploading?: boolean };

const TYPES = [
  { id: 'single-family', label: 'House' },
  { id: 'condo', label: 'Condo' },
  { id: 'townhouse', label: 'Townhouse' },
  { id: 'multi', label: 'Multi-family' },
  { id: 'manufactured', label: 'Manufactured' },
  { id: 'land', label: 'Land' },
  { id: 'other', label: 'Other' },
];

export default function ListingForm() {
  const router = useRouter();
  const { profile } = useProfile();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [address, setAddress] = useState('');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [apn, setApn] = useState<string | null>(null);
  const [cityStateZip, setCityStateZip] = useState<{ city?: string; state?: string; zip?: string }>({});

  const [propertyType, setPropertyType] = useState('single-family');
  const [price, setPrice] = useState('');
  const [beds, setBeds] = useState('');
  const [baths, setBaths] = useState('');
  const [sqft, setSqft] = useState('');
  const [lotSqft, setLotSqft] = useState('');
  const [yearBuilt, setYearBuilt] = useState('');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState<Photo[]>([]);

  const [postedBy, setPostedBy] = useState<'owner' | 'agent'>('owner');
  const [contactName, setContactName] = useState(profile.fullName || '');
  const [contactEmail, setContactEmail] = useState(profile.email || '');
  const [contactPhone, setContactPhone] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // address selected → geocoded; parse city/state/zip + match parcel APN
  const onAddress = useCallback(async ({ lat, lng, address: addr }: { lat: number; lng: number; address: string }) => {
    setAddress(addr);
    setCoords({ lat, lng });
    // parse "123 Main St, City, ST 90000, USA" → city/state/zip (best-effort)
    const parts = addr.split(',').map((p) => p.trim());
    const csz: { city?: string; state?: string; zip?: string } = {};
    if (parts.length >= 3) {
      csz.city = parts[parts.length - 3];
      const stZip = (parts[parts.length - 2] || '').split(/\s+/);
      csz.state = stZip[0];
      csz.zip = stZip[1];
    }
    setCityStateZip(csz);
    // match the parcel APN from the point
    try {
      const r = await fetch(`/api/parcels/at-point?lat=${lat}&lng=${lng}`);
      const j = await r.json();
      setApn(j?.apn ?? null);
    } catch { setApn(null); }
  }, []);

  const addPhotos = useCallback(async (files: FileList | null) => {
    if (!files) return;
    const list = Array.from(files).slice(0, 24 - photos.length);
    for (const file of list) {
      const placeholder: Photo = { url: URL.createObjectURL(file), uploading: true };
      setPhotos((p) => [...p, placeholder]);
      try {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch('/api/listings/upload', { method: 'POST', body: fd });
        const j = await r.json();
        setPhotos((p) => p.map((ph) => (ph === placeholder ? (j.url ? { url: j.url } : null) : ph)).filter(Boolean) as Photo[]);
      } catch {
        setPhotos((p) => p.filter((ph) => ph !== placeholder));
      }
    }
  }, [photos.length]);

  const removePhoto = (i: number) => setPhotos((p) => p.filter((_, idx) => idx !== i));

  const canSubmit = address.trim().length > 0 && !photos.some((p) => p.uploading) && !submitting;

  const submit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true); setErr(null);
    try {
      const r = await fetch('/api/listings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          address, apn, lat: coords?.lat, lng: coords?.lng,
          city: cityStateZip.city, state: cityStateZip.state, zip: cityStateZip.zip,
          propertyType, price, beds, baths, sqft, lotSqft, yearBuilt, description,
          photos: photos.map((p) => p.url),
          postedBy, contactName, contactEmail, contactPhone,
        }),
      });
      const j = await r.json();
      if (!r.ok || !j.id) { setErr(j.error || 'Could not post listing.'); setSubmitting(false); return; }
      router.push(`/listings/${j.id}?new=1`);
    } catch {
      setErr('Something went wrong. Try again.');
      setSubmitting(false);
    }
  }, [canSubmit, address, apn, coords, cityStateZip, propertyType, price, beds, baths, sqft, lotSqft, yearBuilt, description, photos, postedBy, contactName, contactEmail, contactPhone, router]);

  return (
    <div className="lf">
      <div className="lf__head">
        <h1 className="lf__title">Post your listing</h1>
        <p className="lf__sub">It&apos;s free. Add what you can — you can edit later.</p>
      </div>

      {/* owner vs agent */}
      <div className="lf__seg">
        <button className={`lf__segbtn ${postedBy === 'owner' ? 'is-on' : ''}`} onClick={() => setPostedBy('owner')}>I own it</button>
        <button className={`lf__segbtn ${postedBy === 'agent' ? 'is-on' : ''}`} onClick={() => setPostedBy('agent')}>I&apos;m the agent</button>
      </div>

      {/* address */}
      <label className="lf__label">Address <span className="lf__req">required</span></label>
      {address ? (
        <div className="lf__addr">
          <MaterialIcon icon="location_on" className="text-[18px]" />
          <span className="lf__addr-txt">{address}</span>
          <button className="lf__addr-x" onClick={() => { setAddress(''); setCoords(null); setApn(null); }}>Change</button>
        </div>
      ) : (
        <ProspectSearch placeholder="Start typing the property address…" onSelect={onAddress} />
      )}
      {apn && <div className="lf__apn"><MaterialIcon icon="check_circle" className="text-[14px]" /> Parcel matched · APN {apn}</div>}

      {/* type */}
      <label className="lf__label">Property type</label>
      <div className="lf__chips">
        {TYPES.map((t) => (
          <button key={t.id} className={`lf__chip ${propertyType === t.id ? 'is-on' : ''}`} onClick={() => setPropertyType(t.id)}>{t.label}</button>
        ))}
      </div>

      {/* facts grid */}
      <div className="lf__grid">
        <Field label="Price" prefix="$"><input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="450,000" /></Field>
        <Field label="Beds"><input inputMode="decimal" value={beds} onChange={(e) => setBeds(e.target.value)} placeholder="3" /></Field>
        <Field label="Baths"><input inputMode="decimal" value={baths} onChange={(e) => setBaths(e.target.value)} placeholder="2" /></Field>
        <Field label="Sq ft"><input inputMode="numeric" value={sqft} onChange={(e) => setSqft(e.target.value)} placeholder="1,800" /></Field>
        <Field label="Lot sq ft"><input inputMode="numeric" value={lotSqft} onChange={(e) => setLotSqft(e.target.value)} placeholder="7,500" /></Field>
        <Field label="Year built"><input inputMode="numeric" value={yearBuilt} onChange={(e) => setYearBuilt(e.target.value)} placeholder="1998" /></Field>
      </div>

      {/* photos */}
      <label className="lf__label">Photos</label>
      <div className="lf__photos">
        {photos.map((p, i) => (
          <div key={i} className={`lf__photo ${p.uploading ? 'is-up' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" />
            {p.uploading && <div className="lf__photo-spin"><MaterialIcon icon="progress_activity" className="text-[22px] lf__spin" /></div>}
            {!p.uploading && <button className="lf__photo-x" onClick={() => removePhoto(i)} aria-label="Remove"><MaterialIcon icon="close" className="text-[16px]" /></button>}
          </div>
        ))}
        {photos.length < 24 && (
          <button className="lf__photo-add" onClick={() => fileRef.current?.click()}>
            <MaterialIcon icon="add_a_photo" className="text-[24px]" />
            <span>Add photos</span>
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => addPhotos(e.target.files)} />
      </div>

      {/* description */}
      <label className="lf__label">Description</label>
      <textarea className="lf__ta" rows={4} value={description} onChange={(e) => setDescription(e.target.value)}
        placeholder="What makes it special — updates, the neighborhood, the view, terms you'd consider…" />

      {/* contact */}
      <label className="lf__label">How buyers reach you</label>
      <div className="lf__grid lf__grid--contact">
        <Field label="Name"><input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Your name" /></Field>
        <Field label="Email"><input inputMode="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="you@email.com" /></Field>
        <Field label="Phone"><input inputMode="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="(555) 555-5555" /></Field>
      </div>

      {err && <div className="lf__err"><MaterialIcon icon="error" className="text-[16px]" /> {err}</div>}

      <button className="lf__submit" disabled={!canSubmit} onClick={submit}>
        {submitting ? 'Posting…' : 'Post listing — free'}
      </button>
      <p className="lf__free"><MaterialIcon icon="verified" className="text-[14px]" /> No fee, ever. You can edit or take it down anytime.</p>

      <ListingFormStyles />
    </div>
  );
}

function Field({ label, prefix, children }: { label: string; prefix?: string; children: React.ReactNode }) {
  return (
    <div className="lf__field">
      <span className="lf__field-l">{label}</span>
      <div className="lf__field-in">{prefix && <span className="lf__prefix">{prefix}</span>}{children}</div>
    </div>
  );
}

function ListingFormStyles() {
  return (
    <style>{`
      .lf { max-width: 680px; margin: 0 auto; padding: 28px 20px 80px; }
      .lf__head { margin-bottom: 20px; }
      .lf__title { font-size: 1.9rem; font-weight: 800; color: #122d8d; letter-spacing: -0.01em; }
      .lf__sub { margin-top: 4px; color: #5a6a8c; font-size: 0.95rem; }
      .lf__seg { display: inline-flex; background: #e6eefb; border-radius: 12px; padding: 4px; margin-bottom: 22px; }
      .lf__segbtn { padding: 9px 18px; border-radius: 9px; font-weight: 700; font-size: 14px; color: #4a5a7c; }
      .lf__segbtn.is-on { background: #fff; color: #1349d4; box-shadow: 0 2px 8px -3px rgba(20,50,120,0.3); }
      .lf__label { display: block; margin: 20px 0 8px; font-size: 13px; font-weight: 800; letter-spacing: 0.04em;
        text-transform: uppercase; color: #3a4a72; }
      .lf__req { margin-left: 6px; font-size: 10px; color: #1349d4; background: rgba(19,73,212,0.1);
        padding: 2px 6px; border-radius: 6px; letter-spacing: 0.02em; }
      .lf__addr { display: flex; align-items: center; gap: 8px; padding: 13px 14px; border-radius: 12px;
        background: #fff; border: 1.5px solid rgba(19,73,212,0.25); color: #122d8d; }
      .lf__addr-txt { flex: 1; font-weight: 600; font-size: 15px; }
      .lf__addr-x { font-size: 13px; font-weight: 700; color: #1349d4; }
      .lf__apn { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; font-size: 12.5px;
        font-weight: 700; color: #1a8f4c; }
      .lf__chips { display: flex; flex-wrap: wrap; gap: 8px; }
      .lf__chip { padding: 9px 15px; border-radius: 999px; font-size: 14px; font-weight: 600; color: #4a5a7c;
        background: #fff; border: 1.5px solid rgba(19,73,212,0.16); }
      .lf__chip.is-on { background: #1349d4; color: #fff; border-color: #1349d4; }
      .lf__grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .lf__grid--contact { grid-template-columns: 1fr; }
      @media (min-width: 560px) { .lf__grid--contact { grid-template-columns: repeat(3, 1fr); } }
      .lf__field-l { display: block; font-size: 12px; font-weight: 600; color: #6b7699; margin-bottom: 4px; }
      .lf__field-in { display: flex; align-items: center; gap: 4px; background: #fff; border: 1.5px solid rgba(19,73,212,0.16);
        border-radius: 11px; padding: 0 12px; }
      .lf__field-in:focus-within { border-color: rgba(19,73,212,0.5); }
      .lf__prefix { color: #6b7699; font-weight: 600; }
      .lf__field-in input { flex: 1; min-width: 0; border: none; outline: none; background: transparent;
        padding: 12px 0; font-size: 15px; color: #0f2b6b; }
      .lf__photos { display: grid; grid-template-columns: repeat(auto-fill, minmax(96px, 1fr)); gap: 10px; }
      .lf__photo { position: relative; aspect-ratio: 1; border-radius: 12px; overflow: hidden; background: #e6eefb; }
      .lf__photo img { width: 100%; height: 100%; object-fit: cover; }
      .lf__photo.is-up img { opacity: 0.5; }
      .lf__photo-spin { position: absolute; inset: 0; display: grid; place-items: center; color: #1349d4; }
      .lf__spin { animation: lfspin 0.9s linear infinite; }
      @keyframes lfspin { to { transform: rotate(360deg); } }
      .lf__photo-x { position: absolute; top: 5px; right: 5px; width: 24px; height: 24px; border-radius: 50%;
        background: rgba(10,20,40,0.6); color: #fff; display: grid; place-items: center; }
      .lf__photo-add { aspect-ratio: 1; border-radius: 12px; border: 2px dashed rgba(19,73,212,0.3);
        display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
        color: #1349d4; font-size: 12px; font-weight: 700; background: rgba(19,73,212,0.04); }
      .lf__ta { width: 100%; border: 1.5px solid rgba(19,73,212,0.16); border-radius: 12px; padding: 13px 14px;
        font-size: 15px; color: #0f2b6b; outline: none; resize: vertical; font-family: inherit; background: #fff; }
      .lf__ta:focus { border-color: rgba(19,73,212,0.5); }
      .lf__err { display: flex; align-items: center; gap: 6px; margin-top: 16px; color: #c0392b; font-size: 14px; font-weight: 600; }
      .lf__submit { width: 100%; margin-top: 26px; padding: 16px; border-radius: 14px; border: none;
        background: var(--plot-brand, #1349d4); color: #fff; font-size: 16px; font-weight: 700; cursor: pointer;
        box-shadow: 0 14px 30px -12px rgba(19,73,212,0.6); transition: background .15s, transform .15s; }
      .lf__submit:hover:not(:disabled) { background: var(--plot-brand-deep, #122d8d); transform: translateY(-1px); }
      .lf__submit:disabled { opacity: 0.5; cursor: default; box-shadow: none; }
      .lf__free { display: flex; align-items: center; justify-content: center; gap: 6px; margin-top: 14px;
        font-size: 12.5px; color: #1a8f4c; font-weight: 600; }
    `}</style>
  );
}
