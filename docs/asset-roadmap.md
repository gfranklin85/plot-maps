# Plot — Asset Roadmap

**Status:** living document
**Owner:** Greg (craft) + Claude (briefs, runtime integration, status tracking)
**Last updated:** 2026-05-18

Every visual artifact in Plot lives here. Tracks what's committed, what's in flight, what's not yet briefed. This is not a todo list — todos are short-lived; this is the canonical index of Plot's craft surface.

**The rule:** Every entry here is hand-crafted in a real tool (Affinity, Blender, Spline, paint, etc.). No library defaults, no CSS shortcuts, no AI-generated finals. See `feedback_no_basic_css_magic` memory.

**Plot Space dual-use flag (🌌):** Entries marked 🌌 do double duty as v1 assets for the future Plot Space product. Same asset, two surfaces. Build with both in mind.

---

## Status legend

- 🟢 **Shipped** — in production, on the live map
- 🟡 **In flight** — Greg crafting or Claude wiring right now
- 🔵 **Briefed** — design doc exists; ready to start when Greg reaches it
- ⚪ **Identified** — committed in principle, no brief yet
- 🔴 **Blocked** — waiting on upstream decision or dependency

---

## I. SKY & ATMOSPHERE (🌌 most of this is Plot Space v1)

### Sky Dome — the inverted-ball geometry
- **Status:** 🟡 In flight
- **Tool:** Blender
- **What it is:** A 128×64 inverted UV sphere with equirectangular unwrap and an emission shader. The "screen" that the sky paintings wrap onto. Built once, used forever, swappable textures.
- **Brief:** `docs/lite-buyer-first-touch-design.md` (referenced) and inline in 2026-05-18 conversation
- **Export:** `sky-dome.glb` (glTF binary, single file)
- **Notes:** This is the *frame* of the cathedral, not the painting. Geometry is invisible; only the texture matters visually. But it has to be right (smooth horizon, normals flipped, UVs unwrapped) so paintings wrap cleanly.

### Sky Paintings — the four phase variants
- **Tool:** Blender / Affinity / paint of choice
- **Format:** Equirectangular .png (or .exr for higher color range), 4096×2048
- **Sun-position note:** Paint each variant with the sun in a fixed spot on the canvas (e.g. right edge). Runtime rotates the dome so the painted sun aligns with the real sun's azimuth for the user's time + location.

| Variant | Status | Brief notes | 🌌 |
|---|---|---|---|
| Night (Plot constellations + Milky Way + Plot lore + Central Valley horizon glow) | 🟡 In flight | The money shot for atmosphere and the canvas of Plot Space. Plot's invented constellations (Compass Rose, Surveyor's Transit, Brass Pin, Lantern, Field Stake — plus more if inspired). Sparse 5-10 visible stars in twilight, denser into deep night. Hand-painted Milky Way sweep. Hanford/Lemoore light pollution as warm horizon glow. Optional: faint atmospheric perturbation near horizon. | 🌌 |
| Day | 🔵 Briefed | Warm zenith blue (#5b7ba8) → hazy pale horizon (#c8d4dc). Subtle paper-grain texture overlay. Optional wispy cirrus clouds (ink-wash style). The everyday baseline. | |
| Golden Hour | 🔵 Briefed | The dramatic phase. White-hot sun core → amber halo → warm gold → cooler opposite-side blue. Cumulus clouds catching low warm light from below. *The screenshot phase.* | |
| Twilight (Blue Hour) | 🔵 Briefed | Deep indigo zenith → narrow warm horizon band where the sun set → cool dark opposite. First 5-10 stars appearing. Painterly, moody. | 🌌 |

### Plot Constellations
- **Status:** ⚪ Identified
- **Tool:** Concept on paper or Affinity, then baked into the Night sky painting
- **What it is:** A canonical set of invented constellations for the Plot universe. Each one has a *shape* visible in the night-sky painting and a *one-sentence lore* that Plot speaks in the Surveyor's voice. Examples to seed:
  - **Compass Rose** — *"True north for any wanderer."*
  - **Surveyor's Transit** — *"Said to point true north on the longest night of the year."*
  - **Brass Pin** — *"The first claim ever planted, marking the first parcel."*
  - **Lantern** — *"Carried by the field surveyor who never came home."*
  - **Field Stake** — *"Driven into the ground at the edge of the known world."*
- **Plot Space connection:** 🌌 These become tappable interactive objects in Plot Space with their lore as the popover content.

### Moon — separate asset
- **Status:** ⚪ Identified
- **Tool:** Blender (small sphere with painted texture)
- **What it is:** Plot-stylized moon. Slightly warm gray (not the clinical realistic cold gray). Painted craters with hand-drawn weight, not photo-traced. Subtle warmth on the illuminated side suggesting Plot's canonical light.
- **Runtime:** Position calculated from `suncalc` (lat/lng + time). Phase calculated from `suncalc`. The dark portion of the moon is the same texture darkened, not a separate asset.
- **🌌** Big one — interactive moon is core of Plot Space.

### Cloud Layer
- **Status:** ⚪ Identified
- **Tool:** Blender (lo-poly painted cloud puffs)
- **What it is:** ~5-8 distinct cloud "puff" models (cumulus, stratus, scattered cirrus) at varying scales. Painted normals + alpha textures, not photoreal. Death Stranding-tier stylized realism.
- **Runtime:** ~20-40 instances placed at altitude band 1500-3000m, repositioned occasionally as wind drift. Cast no shadows on the map (no shadow API on Map3D) but parallax correctly when flying.

### Planets
- **Status:** ⚪ Identified (Plot Space)
- **🌌** Pure Plot Space.
- **What it is:** Painted versions of Mercury, Venus, Mars, Jupiter, Saturn. Saturn's rings included. Each is a separate sphere asset like the moon.
- **Runtime:** Position computed from ephemeris library (free, no API). Only visible when above horizon for user's location.
- **Defer:** Until atmospheric Plot ships. Built in the Plot Space sprint.

### Satellites
- **Status:** ⚪ Identified (Plot Space)
- **🌌** Pure Plot Space.
- **What it is:** Real satellites (ISS, Hubble, Starlink trains, named major sats) rendered as tiny bright moving points across the sky. Real-time positions from CelesTrak TLE feeds.
- **Notes:** No 3D asset needed — satellites are too small for geometry; they're just luminous points painted at the right position each frame. Naming + interactivity is the work.

### Shooting Stars / Meteors
- **Status:** ⚪ Identified (runtime, not asset)
- **Tool:** Pure runtime — a thin streak drawn across the sky every 60-120 seconds at night
- **Plot Space upgrade:** Real meteor shower data from IMO calendars — Perseids in August, Geminids in December, etc. — shows real meteor rates and radiants on those nights.

### Atmospheric color wash (legacy)
- **Status:** 🟢 Shipped (will be demoted)
- **Tool:** CSS — the existing `AtmosphereOverlay` component
- **Disposition:** Once the sky dome is in, this gets retuned to be a thin "ground-bounce tint" only (subtle warmth on the bottom of the frame at golden hour, suggesting light bouncing off the ground onto the camera lens). The sky dome carries 95% of the atmospheric weight; this is the bottom 5% the dome can't physically reach.

---

## II. PIN FAMILY — the 3D Plot Pins

Per the 2026-05-18 MK1-tier render mock, this family of 6 pins is the spine of Plot's spatial product surface. All hand-crafted in Blender with PBR materials, separable emissive layers for the glow language.

### Survey Stake (Prospect)
- **Status:** 🟢 Hero render delivered (2026-05-18); production-ready glTF pending
- **Tool:** Blender
- **What it is:** Wood post with bolted brass cap (engraved Parcel ID), red cloth flag with surveyor's compass insignia, NFC/QR placard, survey spike driving into dirt, LED locator ring under the brass cap.
- **State:** "Prospect" — newly planted, fresh interest.

### Brass Monument (Active Listing)
- **Status:** ⚪ Identified (mocked in pin-family panel)
- **Tool:** Blender
- **What it is:** Brass dome on stone pedestal, Parcel ID engraved on the dome. State: "Active Listing" — significant, formal, weight of public record.

### Beacon Tower (Campaign Center)
- **Status:** ⚪ Identified (mocked in pin-family panel) — Claude flagged as next-up after Survey Stake
- **Tool:** Blender
- **What it is:** Tall slim tower with a glowing lantern at the top, a small notice board mid-tower. State: "Campaign Center" — actively working a campaign from this point.
- **Why this is next:** It's the pin a Pro agent looks at most during active outbound. Mid-zoom silhouette + glow define what "working a campaign" *feels* like.

### Ledger Post (Imported Leads)
- **Status:** ⚪ Identified (mocked)
- **What it is:** Short wooden post with a small parchment ledger pinned to it, wax seal. State: "Imported Leads" — bookkeeping origin.

### Lantern Marker (Active Call)
- **Status:** ⚪ Identified (mocked)
- **What it is:** Hanging brass lantern with visible flame, mounted on post. State: "Active Call" — live phone activity right now. Animated flame flicker.

### Boundary Cairn (Sold / Archived)
- **Status:** ⚪ Identified (mocked) — Claude specifically called this out as brilliant
- **What it is:** Stacked-stone cairn, sturdy and permanent, brass medallion with Lot ID. State: "Sold / Archived" — transaction complete, immovable.

### Glow Language Layer (cross-cutting)
- **Status:** 🔵 Briefed (memory `project_pin_glow_language`)
- **What it is:** Color × intensity × rhythm × pattern, expressing parcel state without text. Each pin asset above must export with a *separable emissive material layer* so runtime can drive the glow per-instance.

---

## III. SURVEYOR'S TOOL TRAY — Lite Buyer first-touch

Per `docs/lite-buyer-first-touch-design.md`. Five 3D artifacts at the bottom-left of the Lite map view.

| Artifact | Status | Brief |
|---|---|---|
| Compass | ⚪ Identified | Brass with patina, dial visible, needle alive. Function: heading lock / point-north. |
| Dividers | ⚪ Identified | Pair of brass-and-steel dividers with brass joint, steel points. Function: draw a survey circle. |
| Flag Stake (mini) | ⚪ Identified | Smaller version of the Survey Stake from the pin family. Function: mark a parcel. |
| Postcard Envelope | ⚪ Identified | Aged envelope with wax seal, Plot's surveyor's-mark stamp. Function: start an inquiry. |
| Brass Lantern | ⚪ Identified | Carried-by-the-surveyor-style lantern with visible flame. Function: toggle parcel layer. |

All five render with the canonical light from upper-left at ~30° (per `project_visual_rendering_language` memory).

---

## IV. UI CHROME (Affinity — 2D paper/ink layer)

Per `docs/lite-buyer-first-touch-design.md` and the `feedback_right_tool_for_the_asset` memory.

| Artifact | Status | Brief |
|---|---|---|
| Parchment dateline strip | ⚪ Identified | Aged paper texture with deckle edge, carries the live "Tuesday Evening · Hanford, California · 78° clear" line. |
| Drift-card backgrounds | ⚪ Identified | Larger parchment surface for the "caught my eye" card and other floating-drift cards. Aged paper, subtle fiber, soft drop shadow. |
| Brass medallion + ribbon (user mark) | ⚪ Identified | User's initials engraved on a brass medallion, hung from a small parchment ribbon ("Surveyor, 1st Class · commissioned May 10, 2026"). Top-right corner of map view. |
| Tool tooltips (parchment style) | ⚪ Identified | Small parchment notes that drift up above each tool when focused. Hand-written look. |
| Coach card (first-activation) | ⚪ Identified | Parchment card with a hand-drawn arrow pointing at the new feature. One-time, never again. |
| Brass plaques (saved fields) | ⚪ Identified | Small brass plaques pinned to a corner rail when the user saves a "field" (named view). Click to fly the camera back to that pose. |

---

## V. POSTCARDS & PHYSICAL OUTBOUND (Affinity + print)

Per the active prospecting backend workstream.

| Artifact | Status | Brief |
|---|---|---|
| Postcard front (canonical Plot design) | ⚪ Identified | The first postcard template Plot mails on the user's behalf. Surveyor's-mark stamp area, illustrated parcel sketch, hand-set type. |
| Postcard back (recipient address area + Plot logo + opt-out info) | ⚪ Identified | Legally compliant back side. The opt-out language is the only ungoverned-by-craft area; rest is hand-designed. |
| Surveyor's-mark stamp | ⚪ Identified | The recurring stamp/seal that appears on postcards, the postcard envelope tool, the user's commission ribbon. Should be a single canonical Plot icon, hand-drawn, used everywhere. |

---

## V-a. MAP UI ICONOGRAPHY — the most-touched surface in Plot

Auditing the live `/map` page, ~30 generic Material icons currently serve as buttons, badges, and labels on the most-used surface in the product. Each one gets replaced with a hand-crafted artifact in the Plot visual world. Every map session starts with eyes hitting these.

**The discipline:** all map UI artifacts share one visual hand — same brass tone, same patina age, same edge weight, same lighting (canonical light upper-left at ~30°, per `project_visual_rendering_language`). Build 2-3 of the universal recurring artifacts FIRST to lock the visual language; everything after inherits.

### V-a.1 — Universal recurring artifacts (build these first, they appear in 3-5 places each)

These ten artifacts cover ~60% of the map's icon surface because they recur. Investing here pays compound returns — designing the rotary phone once retires three different popup icons.

| Artifact | Status | Appears as | Brief |
|---|---|---|---|
| Brass loupe | ⚪ Identified | toolbar Search, popup search inputs, Destinations panel search, future search-anywhere | Small handheld magnifier on a fine chain. Brass body, glass lens, slight patina. The recurring "find" verb. |
| Rotary phone handset | ⚪ Identified | popup "Dial" button, popup phone-number rows, future call surfaces | Real Western-Electric-era handset seen from the side — earpiece on top, mouthpiece on bottom, cloth-wrapped cord. Brass-tinted bell hardware. The recurring "call" verb. |
| Opened envelope + Plot wax seal | ⚪ Identified | popup "Send Invitation", future text inbox, future outbound campaigns | Aged paper envelope, flap open, deep-red Plot wax seal visible on flap or letter peeking out. The wax-seal design is its own canonical Plot artifact (see Surveyor's-mark stamp under Section V). |
| Brass key (small) | ⚪ Identified | every panel close button, every drift-card dismiss, every modal exit | Small period brass key with engraved Plot star on bow. ONE asset that becomes the universal "close" verb across all surfaces. The single most-used artifact in the whole product. |
| Field stake (mini) | ⚪ Identified | Destinations saved-spot rows, Prospect List "add", "pin a card", future "drop a marker" | Smaller proportional version of the Survey Stake from the Pin Family (Section II). The full-size Survey Stake lives in the world as a 3D object; this mini version lives in the UI as a flat illustration. Same craftsmanship, scaled. |
| Worn leather field boots | ⚪ Identified | toolbar Walk Mode, popup "Walk" pill, future walking-mode entries | Pair of well-worn brown leather boots with a small brass compass tag hanging off the laces. The "boots on the ground" verb. |
| Brass surveyor's transit | ⚪ Identified | toolbar Prospect Select, popup "Select Prospects" pill, future targeting | Seen straight-on (the round optical lens face). Brass barrel, fine scope crosshairs visible through the lens. The recurring "precision marking" verb. |
| Plot wax seal (pressed) | ⚪ Identified | popup outcome-logged checkmark, postcard back, future commitment signatures | The CANONICAL Plot signet stamp pressed into deep-red wax. Same design as appears on the envelope flap. Use this as the recurring "this is now committed to the ledger" mark. |
| Migratory bird (line-art) | ⚪ Identified | popup Absentee Owner badge | Single bird in flight, brass-tinted ink-line style. "The owner doesn't roost here." Conceptual match for absentee detection. |
| Brass thumbtack with Plot star | ⚪ Identified | "pin a card" affordance, future "keep on screen" verbs | Small brass thumbtack head viewed from above, Plot star engraved on top. |

### V-a.2 — Flight-mode cockpit artifacts (the cinematic signature)

When this set ships, flight mode genuinely *feels* like a cockpit, not a "3D toggle." This is where the Surveyor's biplane peeks through into the work surface. Highest-impact subset after the universal artifacts.

| Artifact | Status | Function | Brief |
|---|---|---|---|
| Biplane silhouette | ⚪ Identified | toolbar Airplane / Flight Mode toggle | Open-cockpit early-20th-century biplane (matching the Surveyor identity era — 1915-1955). Side view, slight rake. The signature of Plot's flight mode. |
| Brass aviator's altimeter | ⚪ Identified | live altitude gauge (currently text-only) | Circular brass instrument with painted numerals, a real moving needle, glass face. ONE OF THE MOST BEAUTIFUL ARTIFACTS IN THE CATHEDRAL. The needle's motion driven by the live altitude reading at runtime. |
| Brass aircraft trim wheel | ⚪ Identified | Flight Tuning panel button (toolbar) | Rotary brass control wheel with notched markings around its edge. Speaks aviation. |
| Brass trim wheels × 4 (pan / turn / tilt / climb) | ⚪ Identified | inside Flight Tuning panel — replaces CSS sliders | One wheel per axis, each labeled in painted script. The panel becomes a proper instrument cluster. Real interaction: drag the wheel to rotate it, runtime reads angle → multiplier. |

### V-a.3 — Toolbar anchor + map controls

The 9-item map toolbar in the top-right corner.

| Artifact | Status | Function | Brief |
|---|---|---|---|
| Brass instrument-cluster (closed-toolkit) | ⚪ Identified | toolbar anchor (closed state) | Small brass silhouette implying "open my kit" — a mixed-tools cluster (compass + dividers + chain badge composed). The gateway to all map controls. |
| Brass clasp / latch (open-toolkit) | ⚪ Identified | toolbar anchor (open state) | A clasp opening upward. Same brass family as the closed anchor. The closed↔open transition should feel like opening and closing a real brass case. |
| Stack of folded plat-book pages | ⚪ Identified | toolbar Layers | Stack of aged paper plat-book pages with a corner curled up. Direct speak to the cartography brand. |
| Carved wooden topo relief | ⚪ Identified | toolbar Photoreal 3D toggle (Hybrid mode) | Small carved wooden relief map — topo-style ridges, 3D suggestion in 2D form. The "raise the world" button. |
| Monocle (with chain) | ⚪ Identified | toolbar POI visibility — visible state | Brass-rimmed monocle dangling on a fine chain. |
| Monocle in folded brass case | ⚪ Identified | toolbar POI visibility — hidden state | Same monocle but stowed in a closed case. Two states, one artifact family. |
| Antique globe on stand | ⚪ Identified | toolbar Destinations / Public | Period globe on a brass meridian stand, tilted slightly. The journey-to-anywhere artifact. |
| Brass admin pin (corner ornament) | ⚪ Identified | replaces text "ADM" badge on admin-only tools | Small brass commission pin worn at the corner of a tool. Plot lore: "you have the surveyor general's commission." |

### V-a.4 — Popup outcome + state artifacts

Inside PropertyPopup. These appear after a call or interaction.

| Artifact | Status | Function | Brief |
|---|---|---|---|
| Brass survey marker (round disk) | ⚪ Identified | Parcel Details header icon | The round brass disk surveyors set in the ground to mark a benchmark. "This parcel is officially logged." |
| Handwritten letter with quill | ⚪ Identified | outcome: Spoke with Owner | Plot voice — communication just happened. |
| Brass phone receiver set down (off-cradle) | ⚪ Identified | outcome: No Answer | Same family as the rotary phone artifact, in a different state. |
| Open inkwell with quill resting | ⚪ Identified | outcome: Left Voicemail | Surveyor-era voicemail equivalent — message waiting to be inked. |
| Closed inkwell with brass cap | ⚪ Identified | outcome: DNC (Do Not Call) | Same inkwell family, sealed. |
| Brass page-turn ornament (↑ / ↓) | ⚪ Identified | script expand/collapse chevrons | Small brass flourish pointing up or down — the "more in this scroll" affordance. Replaces generic chevrons. |

### V-a.5 — Drift-cards, panels, empty states

| Artifact | Status | Function | Brief |
|---|---|---|---|
| Magnifying glass + crossed-arrows ornament | ⚪ Identified | "expand to full" affordance on drift cards | Brass loupe combined with crossed expansion arrows beneath. Brass-tinted. |
| Empty plat-book page with dashed circle | ⚪ Identified | Prospect List empty state | Large aged paper plat-book page with a single hand-drawn dashed-line circle on it. "You haven't marked anything yet." |
| Brass surveyor's commission badge (chevron) | ⚪ Identified | Upgrade pill | Military-style chevron in Plot palette. "Promote to Pro." |
| Field detective's notebook + portrait sketch | ⚪ Identified | Skip-trace button | Small pocket notebook open to a hand-drawn portrait sketch. "Find the owner." |
| Four brass corner brackets | ⚪ Identified | Fullscreen toggle | Picture-frame brackets that fold inward when tapped. |
| Folded paper map (corner peeled) | ⚪ Identified | Map nav anchor (top-left) — OR Plot wordmark | Brand moment top-left. Could be the Plot wordmark + a small folded paper-map glyph. |
| Brass mailbox with Plot mark | ⚪ Identified | Destinations "Home" | A brass mailbox embossed with the Plot mark. "Home" as a Plot artifact, not a generic house. Could carry user's initials engraved on the side. |

### V-a.6 — Production notes

- **Format:** flat 2D illustrations (Affinity), exported as SVG when possible (crisp at any size, small file) or 256×256 PNG for the more painterly artifacts. The 3D-rendered options (altimeter, trim wheels) export from Blender as 512×512 PNG at retina-2x = 1024×1024 source.
- **Canonical light:** every artifact obeys the canonical Plot light direction — upper-left at ~30°. A loupe with shadow falling down-right; a rotary phone with highlight on the upper-left of the brass; a brass key with the bow lit from upper-left. This is what makes everything feel like *one craftsman touched all of them*.
- **Color discipline:** every artifact draws from the Plat Book palette (`project_brand_palette_direction`). Brass tones range from `#9c7b4a` (deep oxidized) through `#c9a36b` (mid patina) to `#e8c98a` (polished highlight). Don't drift outside this brass family.
- **Build order recommendation:**
  1. **Universal artifacts first** (V-a.1) — these ten retire ~18 generic icons across the product. Even shipping 2-3 of them locks the visual language for everything that follows.
  2. **Flight-mode cockpit artifacts** (V-a.2) — the cinematic signature of flight mode.
  3. **Everything else** (V-a.3, V-a.4, V-a.5) — fills in the remaining surface.
- **Integration:** when an artifact ships, I (Claude) swap the relevant `<MaterialIcon icon="..." />` for `<img src="/assets/icons/..." />` (or `<Icon name="..." />` via a wrapper component we'll set up when the first artifact arrives). Same pattern as the sky dome — runtime is ready, waiting on craft.

---

## VI. COLD OPEN — "The Survey" (CINEMATIC GATE)

Per the cold-open memory. The 90-second cinematic intro is its own asset universe.

| Artifact | Status | Brief |
|---|---|---|
| Theater playbill (subscribe prompt) | ⚪ Identified | Aged 1920s theater poster style. User's name as the protagonist. |
| Credit sequence type | ⚪ Identified | Hand-lettered Plot credit font for "Starring [USER NAME] as the Surveyor." |
| Title card | ⚪ Identified | The first frame — Plot's wordmark + "The Survey" title. |
| Narrator voice | ⚪ Identified | Greg's voice or chosen actor — the Surveyor's voice for the cold open. |

---

## VII. SOUND DESIGN (separate craft — TBD what tool)

Identified for atmospheric Plot:
- Wind ambient (low pad, optional default-off, controller-friendly toggle)
- Distant birds layer
- Single soft chime on certain moments (drift-card arrival, parcel highlight, postcard send)
- Lantern flame flicker (active call pin)
- Surveyor's stake hit (mark a parcel)

Identified for Plot Space (🌌):
- Cosmic / celestial ambient layer
- Soft chime on satellite pass overhead
- Different chime on planet rise

All ⚪ Identified, no briefs yet. Greg's call on sound design tool when we get there.

---

## How this doc is used

- **Greg:** scan it to know what's committed and what's next. Update status as you craft. Add briefs as you write them. This is your asset workshop notebook.
- **Claude:** never propose a new design element without checking if it's already in this doc and either picking up the existing brief or adding a new entry. When a brief is missing, write one *here* in plain language before any code work begins.
- **Both:** every time we ship a crafted asset, move it 🟢, link the file path, and commit. This becomes a permanent record of what Plot's hands built, in order.

---

## What's deliberately NOT here

- **CSS micro-affordances** (focus rings, hairline borders, form field defaults, etc.). Those are invisible mechanics, not branded craft.
- **Stock photography / clipart / generic icons** that we'd never use anyway.
- **AI-generated finals.** The whole point of this doc is the work doesn't come from an AI shortcut. AI can sketch references; AI cannot ship.
