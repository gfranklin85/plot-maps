# Sortie 1 — Fly Lemoore in Unreal (Cesium + Google Photoreal Tiles)

A side flight. Not a program, not a rebuild. The goal is to SEE your own
world through a video-game renderer once. No timeline. Have fun.

The web app keeps running exactly as-is — this touches nothing in the repo.

---

## What you're doing

Loading Google's *same* photorealistic 3D tiles (the real Earth mesh) into
Unreal Engine 5 via the free Cesium plugin, then flying over Lemoore in
your own renderer.

---

## Steps

**1. Install Unreal Engine 5**
- Get the Epic Games Launcher (free): https://www.epicgames.com/store/download
- Launcher → Unreal Engine → Install (~20–30 GB). This is the only big download.

**2. Get the Cesium for Unreal plugin (free)**
- In the launcher, go to **Fab** (Epic's asset marketplace).
- Search **"Cesium for Unreal"** → Add to My Library (free) → install to your engine version.

**3. New project**
- Unreal → **Games → Blank → Blueprint** (no C++ needed).
- Name it `PlotFlightProof`.

**4. Enable the plugin**
- Edit → Plugins → search **"Cesium"** → check it → restart the editor.

**5. Point it at Google's tiles (use the existing key, skip Cesium ion)**
- Top menu: **Cesium → Cesium** to open the Cesium panel.
- Click **Blank 3D Tiles Tileset** (drops a `Cesium3DTileset` into the scene).
- Select it → **Details** panel → set **Source = From Url**.
- Set **Url** to exactly:
  ```
  https://tile.googleapis.com/v1/3dtiles/root.json?key=AIzaSyA5ak71azQOtSEafy07QvJ0r_LEQ2AsL4w
  ```
- ⚠️ The key needs the **Map Tiles API** turned on in Google Cloud Console
  (that's a *different* API than the Maps JS API the web app uses). If tiles
  don't appear, enable that API first — it's the #1 cause of a blank globe.

**6. Center the world on Lemoore**
- Select the **CesiumGeoreference** actor in the World Outliner.
- Set Origin Latitude **36.301**, Longitude **-119.766**, Height **~300**.
  (Same town as the map screenshot — you'll spawn over the parcels you fly.)

**7. Add the fly camera + go**
- Cesium panel → **Dynamic Pawn** (a globe-aware flight pawn).
- Press **Play**. Fly: **WASD** + mouse look, **Q/E** down/up, **Shift** faster.

That's it. ~45 min, almost all of it the Unreal download.

---

## Bring these 4 numbers back

Type `~` for the console, then `stat fps` to show framerate.

1. **FPS** while flying.
2. **Looks** vs. the web `gmp-map-3d` map — better / same / worse?
3. **Your GPU** + did it stay smooth / fans spin up?
4. **Tile pop-in** — clean load while flying, or stutter?

Those four answers tell us both the visual ceiling AND the hardware reality
in one flight.

---

## What this does NOT decide

Delivery to mass users (couch / TV / phone) would mean **pixel streaming**
— Unreal runs on a cloud GPU, streams video to the browser, user needs no
GPU but we pay cloud-GPU $/session. That's a *later* sortie and a
business-model call. This flight is just: does the door open, and is it
beautiful. Go see it.
