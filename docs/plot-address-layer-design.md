# Plot Address Layer — Design Doc

**Status:** Draft, 2026-05-26
**Owner:** Greg Franklin
**Tag:** Architecture / Core Product

---

## TL;DR

Plot stops asking Google what's on the ground. Plot **knows**. We ingest the entire US public address database (OpenAddresses, ~165M points, federally derived, CC0/ODbL) into Plot's own PostGIS, render Plot-controlled labels over every house and building on the photoreal 3D map, and make every label clickable into Plot's interaction loop. National coverage day one. No Google POI dependency. No MLS, no Zillow, no licensed data, no NAR. The cleanest architecture Plot has ever proposed.

This is the foundation Plot's entire prospecting + commerce product sits on. Everything else (parcel ownership data, MLS where we get it, marketplace, dogfight presence layer) layers on top of this base.

---

## Why now

We just spent two weeks fighting Google's POI layer:

- POI labels disappear at close range and oblique angles
- Cursor aim has to be pixel-perfect on a label that may or may not be there
- Residential addresses aren't in the Places API at all — houses are invisible
- Wrong-POI bug in dense areas (Places Nearby's closest-POI heuristic ≠ user intent)
- Every interaction is gated on Google's hit-test, which we don't control

Every one of those problems traces to a single root cause: **we don't own the data layer.** We're aiming at someone else's labels in someone else's world.

Greg's insight 2026-05-26: "I don't have to steal data or even buy data. I just need to make parcels clickable, or something on the parcel clickable. Pretty much all addresses, which is public info. The whole US's addresses is very public. That could be layered before we even go get rich data."

That reframes the problem. The cursor doesn't need to find a Google POI. The cursor needs to find a Plot label. Plot makes the labels. Plot controls everything about them.

---

## The data thesis

**Tier 0 — every US address (free, federal, ours to host):**

- **OpenAddresses.io** — open-source aggregator. ~165M US address points with lat/lng + street + city + state + zip. CC0 / ODbL licensed. Direct CSV/GeoJSON download. Plot self-hosts.
- **US Census TIGER/Line** — federally published address ranges + street geometry. Free, federal, no permission.
- **OpenStreetMap** — supplemental address tags. Free, OpenDB licensed.
- **USPS ZIP+4 + HUD Crosswalk** — supplemental ZIP-level geocoding. Government data.

**Tier 1 — parcel polygons (mostly free, county-by-county):**

- Most US counties publish parcel polygons as public records. FOIA-accessible by law.
- Plot has Kings County today. Multi-county roll-out is on the existing roadmap.
- Aggregators like Regrid offer national parcel data as a paid shortcut ($) — buy or build is a downstream decision.

**Tier 2 — owner / value / tax data (county assessor, varies):**

- Where Plot has it (Kings County), parcel records carry owner + APN + value + land use.
- Other counties: ingest as Plot expands. Skip-trace fills the gap on demand.

**The product implication:** Plot ships with national coverage of *clickable addresses* on day one, with rich data layered on counties Plot has ingested. The user experience is uniform; the data depth varies by region. That's an honest model that scales.

---

## The architectural shift

### Before (today)

```
User clicks → gmp-click event → Google POI hit-test
  → if POI: Place Details API → popup
  → if ground: parcel-at-point PostGIS query → popup
```

Two failure modes:
- POI hit-test misses (cursor not on Google's label)
- Parcel data unavailable outside Kings County (most of the world)

### After (this design)

```
User clicks → gmp-click event → surface lat/lng from Map3D ray-cast
  → spatial query: Plot's address layer (within N meters)
  → spatial query: Plot's parcel polygons (point-in-polygon, where available)
  → spatial query: Plot's pins (within N meters)
  → priority merge: Plot pin > Plot parcel > Plot address > nothing
  → popup with best result
```

The Google POI layer becomes optional decoration. Plot's own data is the truth.

---

## Scope of v1

**In scope:**

1. Ingest OpenAddresses US dump into Supabase (`addresses` table, ~165M rows)
2. PostGIS GIST spatial index on point geometry
3. Viewport-bbox RPC: `addresses_in_bbox(bbox, max_results)` returns ≤200 nearest addresses
4. `point_lookup` RPC: `address_at_point(lat, lng, radius_m)` returns the single closest address within radius
5. Frontend: `Marker3DElement` layer mounted on `gmp-map-3d`, subscribed to viewport changes via existing camera ref
6. LOD: load only addresses in frustum + max N markers + altitude-gated (no addresses at >2km altitude)
7. Click handler: marker tap opens `PropertyPopup` with stub id `addr:<id>` → backend resolves
8. PropertyPopup resolver branch for `addr:<id>` (mirrors existing `parcel:<APN>` and `gpoi:<placeId>`)
9. Visual: minimal labeled chip (street number + abbreviated street). Plain text on parchment-tinted background. Brand polish in a follow-up.

**Out of scope (v1):**

- Branded label visuals beyond Tier 1 minimum (chip + text). Design pass is separate.
- Multi-state address coverage outside what OpenAddresses provides (some states are sparse — accept gaps; show what we have).
- Owner data enrichment on the address label itself (popup-only for now)
- Parcel polygons as a separate layer (existing parcel work continues independently)
- Replacing Google POIs (we keep them on by default; user can toggle off — eventually we toggle off by default)
- Address marker hover state, animations, clustering (all future)
- Cesium migration of this layer (build for Map3D first; Cesium port follows the asset pipeline work)
- MLS, Zillow, paid-data integration

---

## Data model

```sql
-- New table: addresses
CREATE TABLE addresses (
  id BIGSERIAL PRIMARY KEY,
  street_number TEXT,
  street_name TEXT,
  unit TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  county TEXT,
  geom GEOMETRY(POINT, 4326) NOT NULL,
  source TEXT,          -- 'openaddresses' | 'tiger' | 'osm' | 'manual'
  source_id TEXT,       -- upstream identifier for de-dup
  ingested_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX addresses_geom_idx ON addresses USING GIST (geom);
CREATE INDEX addresses_zip_idx ON addresses (zip);
CREATE INDEX addresses_city_state_idx ON addresses (city, state);
CREATE UNIQUE INDEX addresses_source_dedup ON addresses (source, source_id);
```

**Estimated row count:** ~165M for US. Postgres handles this fine with proper indexing. Storage ~30-50GB depending on text density.

**Supabase tier consideration:** current Pro tier has 8GB included; we'll need to upgrade or move to dedicated infra for the full US dump. Phase the ingest: start with Kings + adjacent counties, expand.

---

## API surface

**Bbox query — for the marker layer to populate the viewport:**

```
GET /api/addresses/in-bbox?n=33.5&s=33.3&e=-119.0&w=-119.2&limit=200
→ { addresses: [{id, street_number, street_name, lat, lng}, ...] }
```

**Point lookup — for the unified A-press handler:**

```
GET /api/addresses/at-point?lat=...&lng=...&radius_m=30
→ { id, street_number, street_name, city, state, zip, lat, lng, distance_m }
```

**Full record — for PropertyPopup resolver:**

```
GET /api/addresses/[id]
→ { id, street_number, street_name, ..., county, geom, ... }
```

---

## Frontend integration

### Marker layer (new component)

`src/components/map/AddressMarkerLayer.tsx` — sibling of `Parcel3DOverlay.tsx`. Mounts inside `<gmp-map-3d>`, reads `camRef` for viewport changes, debounces bbox queries (300ms after camera settles), renders one `<gmp-marker-3d-interactive>` per address with the label as child content.

```tsx
<gmp-marker-3d-interactive
  position={{lat, lng, altitude: 5}}
  altitudeMode="RELATIVE_TO_GROUND"
  onClick={() => onAddressClick(id)}
>
  <div className="plot-address-chip">{streetNumber}</div>
</gmp-marker-3d-interactive>
```

### A-press unification

The current A-press path (Steam Input → OS cursor → click → gmp-click → routes) stays. The change: the gmp-click handler now queries Plot's address layer first, then parcel, then pin, instead of jumping to Google's Place Details. Bullet-proof for residential clicks, no more Leoni Dr bug, no more wrong-POI in dense areas.

```ts
function onMapClick(rawEv) {
  const surfacePos = ev.position ?? ev.detail?.position;
  if (!surfacePos) return;

  // Priority: Plot's data wins over Google's
  const result = await resolveClickPoint(surfacePos.lat, surfacePos.lng);
  // resolveClickPoint queries (in parallel):
  //   1. /api/pins/at-point
  //   2. /api/parcels/at-point   (returns null outside coverage — fine)
  //   3. /api/addresses/at-point
  //   4. /api/places-nearby      (fallback only — gives commercial POIs)

  if (result.kind === 'pin') openPin(result.id);
  else if (result.kind === 'parcel') openParcel(result.apn);
  else if (result.kind === 'address') openAddress(result.id);
  else if (result.kind === 'place') openGooglePoi(result.placeId);
  else {/* nothing under cursor */}
}
```

### PropertyPopup resolver branch

`src/components/map/PropertyPopup.tsx` already handles `parcel:<APN>` and `gpoi:<placeId>` stub ids. Add `addr:<id>` branch that fetches `/api/addresses/[id]` and renders.

### LOD strategy

Markers are cheap individually but death at scale. Plan:

- **Altitude gate:** disable layer when `cam.altitude > 2000m`. Addresses at high altitude are invisible visually and useless interactively. Re-enable on descent.
- **Frustum cull:** use existing camera ref + viewport math to compute bbox, query only addresses inside it.
- **Cap:** max 300 active markers. If bbox returns more, the backend returns the 300 closest to viewport center.
- **Debounce:** bbox query fires 300ms after camera last moved. Avoid hammering during continuous flight.

---

## Visual design (v1)

Minimum viable: small text chip showing street number, parchment-tinted background, navy text. Plot's brand palette. No icon, no badge, no animation. Just text.

```
┌──────┐
│ 546  │
└──┬───┘
```

Tail pointing down at the ground anchor. Tiny shadow for legibility on photoreal tiles. CSS only, no asset work.

Polish pass comes later with the [[project-pin-system-as-product-surface]] sprint. This v1 is intentionally ugly-but-functional so we can ship and feel the interaction before designing.

---

## Ingestion plan

### Phase 1 — Kings County baseline (this sprint)

- Pull Kings County addresses from OpenAddresses + cross-reference Plot's existing parcel data
- Deduplicate against `properties.address` (existing Plot data)
- Import ~50,000 rows. Verifies pipeline + UI before national scale.

### Phase 2 — California (next sprint)

- OpenAddresses CA dump (~12M rows)
- Tests viewport query performance at scale
- Lets Greg fly anywhere in CA and see addresses live

### Phase 3 — National

- Remaining 49 states + DC + territories
- Storage upgrade path locked
- Ongoing freshness: re-ingest OpenAddresses monthly (data updates frequently)

---

## What this unlocks

**Immediately:**

- Every house in Kings County is a clickable Plot entity
- Cursor aim becomes forgiving (large invisible hit-area around each address point)
- Wrong-POI / Leoni Dr bug disappears (we never call the bad parcel resolver again)
- Residential coverage Plot has never had (Places API doesn't include houses)
- All POI interactions branded as Plot, not Google
- Foundation for ammo-as-currency interactions (skip-trace, mail, calls) on every address in the country

**Downstream:**

- Marketplace and commerce ([[project-commerce-social-layer]]) — every storefront is already a Plot address
- Dogfight + presence ([[project-public-presence-layer]]) — every player's home address is already an entity
- Plot Space ([[project-plot-space]]) — same data model extends to stargazing sites
- Real-time presence layer ([[project-real-time-presence-layer-main-thesis]]) — addresses are the substrate this whole thesis sits on

This is the geometric base of Plot's product universe.

---

## Risks and unknowns

1. **OpenAddresses coverage gaps** — some states are sparse, some neighborhoods missing. Verify CA + Kings County density before committing to national rollout.
2. **Address freshness** — new construction, demolished homes, addresses change. Plan for monthly re-ingest. Stale data is a real product harm.
3. **Marker3DElement performance at 300 markers** — Google's renderer hasn't been stress-tested at this scale by us. Bench with synthetic data before committing.
4. **Storage cost** — 165M rows is real money on Supabase. Likely move to dedicated Postgres on Fly.io or Railway when we cross the line.
5. **Coexistence with Google POIs** — keep both visible at v1, but plan toggle UX. Eventually default Google off for paying users.
6. **Click priority arbitration** — what if user clicks bare ground that's both a Plot address AND a Google business POI 5m away? Pick one. Probably Plot. But this is a real edge case worth thinking through.

---

## Sequencing within this design

1. SQL migration for `addresses` table + indexes
2. Ingest script (Node, streams OpenAddresses CSV → Supabase COPY)
3. Bbox + point-lookup RPCs
4. `/api/addresses/*` route handlers
5. `AddressMarkerLayer.tsx` component, mounted in `MapView3D`
6. PropertyPopup resolver branch for `addr:<id>`
7. Unified A-press click resolver (`resolveClickPoint`)
8. Kings County data load (~50k rows)
9. Live test, performance tune
10. California data load + national plan commit

---

## Open questions for Greg

1. **Marker visual v1 — text chip OK, or want to wait for branded design?**
2. **Coverage of Google POIs alongside Plot addresses — both visible, Plot wins on click conflict?**
3. **What does the click-on-bare-ground experience look like when no Plot address is within radius?** Silent no-op? "Nothing here" message? Fall through to Google POI?
4. **Storage tier — okay with the eventual Supabase upgrade or dedicated Postgres later?**
5. **Re-ingest cadence — monthly OK, or want fresher?**

---

## Related project memories

- [[project-pin-system-as-product-surface]] — labels ARE pins; this is that system for parcels
- [[project-readiness-marker-model]] — two-layer marker (private CRM + public owner-set) sits on top of this base
- [[project-commerce-social-layer]] — Plot Public reuses this layer
- [[project-real-time-presence-layer-main-thesis]] — presence overlays on this substrate
- [[reference-map3d-element-extension-model]] — Marker3DElement is the right primitive
- [[project-active-workstream-prospecting-backend]] — this is the missing data foundation
- [[feedback-cathedral-mode]] — this is cathedral-tier; do it right
