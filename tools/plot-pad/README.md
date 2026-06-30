# Plot Pad — Full Gamepad Flight helper

A tiny native Windows app (no runtime, no dependencies) that turns an
Xbox-compatible controller into an OS-level instrument for **plot.solutions**.
A website is sandboxed and can't do these things; this can.

## What it does

| Input | Action | Why it matters |
|-------|--------|----------------|
| **A button** | Real OS left-click at the cursor | Google Map3D's `gmp-click` only fires on a *trusted* (real) click. A synthetic JS click does nothing. This makes A a real click → Google returns the **exact** ground lat/lng under the reticle → pixel-perfect parcel selection at **any** flight angle. (Replaces the trig projection that drifted 700m near the horizon.) |
| **First flight input** (left stick / trigger) | Press **F11** once | Browser goes true full-screen — address/task bars gone, the map fills the glass. |
| **Right stick** | Move the OS cursor | Aim the reticle with the pad, no mouse. The on-screen reticle follows the real cursor (`followCursor` mode), so A's click lands exactly on it. |
| **B** | Escape | Close the property card. |
| **Start/Menu** | Toggle F11 | Manual full-screen. |

It **only acts while a Plot browser window is foreground** (browser process
+ title-substring match), so it never hijacks the rest of the machine.

## Why native (Rust), not AutoHotkey
A compiled AutoHotkey exe that moves the mouse + sends keys often trips
antivirus/SmartScreen heuristics (it looks like automation malware). A native
Rust binary talking straight to Win32 (XInput + SendInput) produces a small,
dependency-free, AV-friendly `.exe` that signs cleanly and looks professional
on a front-page download. Same one-file experience for the user; better
foundation.

## Build (source → distributable .exe)

One-time toolchain install (you, on the dev machine):
```powershell
# Install Rust (includes cargo). ~5 min, one time.
#   https://rustup.rs   →  run rustup-init.exe, accept defaults
# Then restart the shell so `cargo` is on PATH.
```

Build the release binary:
```powershell
cd tools/plot-pad
cargo build --release
# Output: target/release/PlotPad.exe  (small, no console window)
```

Copy it to the public download slot the landing page links to:
```powershell
Copy-Item target/release/PlotPad.exe ../../public/download/PlotPad.exe -Force
```

The landing hero's **Download Plot Pad** button links to `/download/PlotPad.exe`.

### Signing — EV cert, cloud HSM (the real publish path)
Unsigned, SmartScreen shows "unknown publisher". We sign with an **EV
code-signing certificate** (instant SmartScreen trust, zero warning from
download #1) issued to **Plot Solutions LLC**, held in a **cloud HSM** (no
USB token) via **SSL.com eSigner**.

The whole build → sign → publish is one script:
```powershell
# Signed (needs EV cert + eSigner env vars — see build-and-sign.ps1 header):
pwsh tools/plot-pad/build-and-sign.ps1
# Unsigned (local testing only):
pwsh tools/plot-pad/build-and-sign.ps1 -NoSign
```

**One-time provisioning (account-holder action):**
1. Plot Solutions LLC: active registration + a **D-U-N-S number** (free from
   D&B; request early — issuance can take days/weeks and EV requires it) +
   a public business phone the CA can call.
2. Buy an **EV cert** from SSL.com (cloud/eSigner option, not the USB token).
3. Complete SSL.com's identity validation (LLC verify + phone call).
4. Set the eSigner env vars (see `build-and-sign.ps1` header) and run the
   signed build. The script verifies the resulting signature is `Valid`.

## Test loop
1. `cargo build --release` (debug build keeps a console window for logs:
   `cargo run`).
2. Open `localhost:<port>/map?view=3d`, focus the tab.
3. Push the left stick → the page should go full-screen (F11).
4. Aim with the right stick (the reticle follows the cursor), press **A** →
   the property under the reticle should open (Google's `gmp-click` resolves
   it). **B** closes it.
