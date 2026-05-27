# Plot Controller Setup

Plot treats your game controller the same way it treats your mouse — as a system input device. That means the controller needs to drive the OS cursor and clicks at the **operating-system layer**, not inside the browser. Windows doesn't do this automatically (it sees a controller as a "game thing" and leaves it alone), so you wire it up once with Steam Input. It's a 2-minute setup and it works in every browser, every app, forever after.

After setup:

- **A button** fires a click at the cursor — anytime, no modifier needed.
- **B button** opens right-click menus — anytime.
- **Hold LB + move RIGHT stick** = cursor movement. Release LB and the right stick goes back to camera look. The cursor stays parked wherever you left it.
- **Right stick (no LB)** stays raw for Plot's camera look.
- **Left stick** stays raw for Plot's flight controls — forward / reverse / strafe. Never moves the cursor.
- **Triggers (LT/RT)** stay raw for Plot's flight controls (altitude).

## The mental model

The cursor is a **set-and-forget reticle** in screen space — a target you place once and fly the world underneath.

1. Hold LB + push right stick → the cursor lands on the house / business / parcel you want.
2. Release LB → you're back to flying. The cursor doesn't move; it stays parked on that target.
3. Fly the plane — bank, climb, orbit, approach. The cursor still doesn't move; it's pinned in screen space.
4. Press A whenever you want → the click fires at the parked cursor position. Opens the popup for whatever's underneath it right now.

This is the opposite of a normal mouse. A normal cursor follows the pointer; this one is a stationary aim point you fly your view through. Same idea as a rifle scope you've sighted in — the crosshair stays still and you walk the target into it.

### Why right stick (not left)

Two-handed ergonomics. Your right thumb is already your fine-aim hand for camera look; the cursor sits on the same muscle. Meanwhile your left hand keeps flying with the left stick uninterrupted, and your left index finger gates the cursor mode with LB. No thumb gymnastics, no mode confusion.

LB is the "let me re-aim" modifier. Hold it, nudge the right stick, let go. You're flying again with a new target locked.

---

## Setup (Windows, 2 minutes)

### 1. Install Steam (if you don't have it)

Free download: <https://store.steampowered.com/about/>

You don't need a Steam library or any games. You're only using its Controller service.

### 2. Plug in your controller

Xbox, PlayStation, Switch Pro, 8BitDo — all supported. USB or Bluetooth, doesn't matter. Steam will detect it automatically.

### 3. Open Steam → Settings → Controller

In the Steam window: top-left **Steam** menu → **Settings** → **Controller** tab on the left.

You should see your controller listed under "Detected Controllers." If you don't, unplug and replug it, or check that Bluetooth pairing succeeded.

### 4. Enable Steam Input

Make sure these toggles are **ON**:

- "Xbox Configuration Support" (if Xbox controller)
- "PlayStation Configuration Support" (if PS controller)
- "Generic Gamepad Configuration Support" (catch-all)

### 5. Configure the Desktop Layout

Click the **"Desktop Layout"** button (sometimes labeled "Edit" next to "Desktop"). This is the config Steam applies whenever you're NOT in a Steam game — i.e. the rest of the time, including in Plot.

Set the following bindings:

| Controller input | OS action |
|---|---|
| **A button** (X on PS, B on Switch) | Left Mouse Click |
| **B button** (Circle on PS, A on Switch) | Right Mouse Click |
| **Right stick** | Mouse Movement, **gated by LB** — i.e. only emits cursor movement while Left Bumper is held |
| **Left Bumper (LB / L1)** | Modifier — held to enable right-stick → cursor. **Do NOT bind LB to a key.** It should act only as a modifier inside Steam's Right Stick binding (Steam calls this an "Action Layer" or "Modeshift"). |
| **D-pad** | Arrow Keys |
| **Left stick** | *(leave unbound — Plot reads it raw for flight)* |
| **Left trigger (LT/L2)** | *(leave unbound — Plot reads it raw)* |
| **Right trigger (RT/R2)** | *(leave unbound — Plot reads it raw)* |
| **X button / Y button** | *(leave unbound — Plot reads them raw for inspect/rotate)* |

The "leave unbound" inputs need to pass through to the browser untouched. If Steam binds them to keyboard keys, Plot's flight model won't see them.

**Setting the LB-gated right stick in Steam:** open the Right Stick binding, choose "Mouse" as the style, then add an Action Layer / Modeshift triggered by Left Bumper. The default (no LB) is **no binding** — the right stick passes through raw to the browser for camera look. The modeshift (LB held) is **Mouse Movement**. Some Steam versions call this "Activator: Modeshift on LB Hold."

### 6. Save the layout

Steam saves automatically. You can give it a name like "Plot Desktop" if you want to find it later.

### 7. Test

Without holding anything: nudge the right stick. The cursor should NOT move (it passes through to whatever app is in focus). Now hold **LB** and push the right stick — the cursor moves. Release LB and the cursor stops. Press **A** — clicks at the cursor. If that all works, Plot will work.

---

## In Plot

- Aim: hold **LB**, push the **right stick**, park the cursor on the house / business / parcel you want, release LB.
- Fly: left stick (forward / reverse / strafe), right stick (camera look), triggers (altitude). Cursor stays parked.
- Fire: press **A** anytime. Click happens at the cursor position. Opens the Plot PropertyPopup.

The Plot reticle (crosshair at screen center) is still useful as a flight sight, but the actual click happens at your **cursor position**, not the reticle. Park the cursor first, then fly your view, then press A.

---

## Troubleshooting

**Cursor doesn't move when I hold LB + push right stick.**
Steam isn't running, or the Right Stick modeshift isn't wired. Open Steam → Controller → Desktop Layout, click Right Stick, confirm style = Mouse with an Action Layer / Modeshift triggered by Left Bumper that emits Mouse Movement.

**Cursor moves even when I'm NOT holding LB.**
The Right Stick is bound to Mouse Movement at the base layer instead of inside the LB modeshift. Clear the base binding on Right Stick — leave it empty. Mouse Movement should ONLY exist inside the LB-held modeshift.

**A button doesn't click anything.**
Confirm A is bound to "Left Mouse Click" in the Desktop Layout, not to a keyboard key.

**Plot's flight controls stopped working after I set this up.**
You probably bound the left stick, right stick (base layer), or triggers in Steam. Those need to be left blank so the browser sees the raw axes. The ONLY non-empty bindings should be: A → Left Click, B → Right Click, Right Stick (LB modeshift only) → Mouse Movement, optionally D-pad → Arrow Keys.

**Camera look stopped working in Plot when I push the right stick.**
Same root cause — the right stick has a base-layer binding it shouldn't. Clear it; the right stick should only do something while LB is held.

**It works in some browsers but not Chrome.**
Steam Input is OS-level — it works in every browser. If the cursor isn't moving in Chrome specifically, Steam isn't running. (Confirm by hovering the Steam icon in the system tray.)

---

## Mac / Linux

Steam Input works identically on Mac and Linux. The menu paths are the same. Bluetooth pairing is slightly different per OS, but once the controller is paired, Steam takes over.

---

## Why this isn't built into Plot

A web page (any web page) cannot drive the real OS mouse cursor from JavaScript — it's a browser security boundary. Plot can read the controller's button presses while the browser tab is focused, but it cannot move your cursor or fire real clicks. Steam Input runs at the OS layer, before the browser, so it can.

The trade-off is one 2-minute setup. The upside is that your controller now works as a real input device across every app on your computer — not just Plot.
