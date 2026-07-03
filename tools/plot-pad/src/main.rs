//  ██████  PLOT PAD  ██████
//  Full Gamepad Flight — the OS-level helper for plot.solutions.
//
//  A website is sandboxed. This tiny native helper is not. While a Plot
//  browser window is focused, it:
//    • A button → a REAL OS left-click at the cursor. Google Map3D's
//      gmp-click only fires on a TRUSTED (real) click — a synthetic JS
//      click does nothing. This makes A a real click, so Google returns
//      the EXACT ground lat/lng under the reticle → pixel-perfect parcel
//      selection at any flight angle. (Replaces the trig projection that
//      drifted 700m near the horizon.)
//    • First flight input (stick/trigger) → presses F11 once → the browser
//      goes true full-screen, chrome off, map fills the glass.
//    • Right stick → moves the OS cursor, so the reticle aims with the pad.
//    • B → Escape (close the property card).  Start/Menu → F11 toggle.
//
//  It reads the pad only while a Plot window is foreground, so it never
//  hijacks the rest of the machine.
//
//  Native Win32 (XInput + SendInput) — no runtime, no dependencies, one
//  small signed .exe. © Plot Solutions LLC.
//  memory/project_plot_pad_os_click_helper
//
//  Build:  cargo build --release   →   target/release/PlotPad.exe
//  (windows subsystem = no console window; see build.rs)

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{thread, time::Duration};

use windows::Win32::Foundation::{HWND, MAX_PATH};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, MOUSEEVENTF_LEFTDOWN, MOUSEEVENTF_LEFTUP,
    MOUSEEVENTF_MOVE, MOUSEINPUT, VIRTUAL_KEY, VK_ESCAPE, VK_F11,
};
use windows::Win32::UI::Input::XboxController::{
    XInputGetState, XINPUT_GAMEPAD_A, XINPUT_GAMEPAD_B, XINPUT_GAMEPAD_LEFT_SHOULDER,
    XINPUT_GAMEPAD_START, XINPUT_STATE,
};
use windows::Win32::UI::WindowsAndMessaging::{
    GetForegroundWindow, GetWindowTextW, GetWindowThreadProcessId,
};

// ── Tuning ────────────────────────────────────────────────────────────
const POLL_MS: u64 = 8; // ~120 Hz
const DEADZONE: i32 = 8000; // XInput axis is -32768..32767
const FLIGHT_ENGAGE: i32 = 12000; // stick magnitude that counts as "flying"
const TRIGGER_ENGAGE: u8 = 40; // trigger value that counts as throttle/climb
const CURSOR_SPEED: f32 = 18.0; // px per poll at full right-stick deflection

// Window titles / process names that mean "this is Plot". We act only when
// one of these is foreground. Substring, case-insensitive.
const TITLE_HINTS: &[&str] = &[
    "plot.solutions",
    "plot maps",
    "plotmaps",
    "/map",
    "plot pad",
    "localhost",
];
// Browser process names — a Plot tab lives inside one of these. We require
// BOTH a browser process AND a title hint, so a random "localhost" terminal
// window doesn't qualify.
const BROWSER_HINTS: &[&str] = &[
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "brave.exe",
    "opera.exe",
    "vivaldi.exe",
    "code.exe",     // VS Code Simple Browser (dev testing)
    "arc.exe",
];

fn deadzone(v: i32) -> i32 {
    if v.abs() < DEADZONE {
        0
    } else {
        v
    }
}

/// Title of the foreground window, lowercased.
fn foreground_title_lower() -> String {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return String::new();
        }
        let mut buf = [0u16; 512];
        let n = GetWindowTextW(hwnd, &mut buf);
        if n <= 0 {
            return String::new();
        }
        String::from_utf16_lossy(&buf[..n as usize]).to_lowercase()
    }
}

/// Executable name of the foreground window's process, lowercased.
fn foreground_process_lower() -> String {
    unsafe {
        let hwnd: HWND = GetForegroundWindow();
        if hwnd.0.is_null() {
            return String::new();
        }
        let mut pid: u32 = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return String::new();
        }
        let Ok(handle) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return String::new();
        };
        let mut buf = [0u16; MAX_PATH as usize];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(buf.as_mut_ptr()),
            &mut len,
        )
        .is_ok();
        let _ = windows::Win32::Foundation::CloseHandle(handle);
        if !ok {
            return String::new();
        }
        let full = String::from_utf16_lossy(&buf[..len as usize]).to_lowercase();
        // keep just the exe filename
        full.rsplit(['\\', '/']).next().unwrap_or(&full).to_string()
    }
}

/// True when a Plot browser window is in the foreground.
fn plot_focused() -> bool {
    let proc = foreground_process_lower();
    let is_browser = BROWSER_HINTS.iter().any(|b| proc.contains(b));
    if !is_browser {
        return false;
    }
    let title = foreground_title_lower();
    TITLE_HINTS.iter().any(|h| title.contains(h))
}

/// True only when the MAP page is focused. F11 fullscreen belongs to the map
/// (flight) ONLY — never the landing page or general browsing. The map page
/// sets a DISTINCT document.title ("Plot Maps — Flight Map"); the generic site
/// title ("Circle Prospecting Tool") shows on every page and must NOT match.
fn map_focused() -> bool {
    if !plot_focused() {
        return false;
    }
    let title = foreground_title_lower();
    title.contains("flight map") || title.contains("/map")
}

// ── SendInput helpers — all REAL OS input events (isTrusted in browser) ─

fn send_mouse_move(dx: i32, dy: i32) {
    let input = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx,
                dy,
                mouseData: 0,
                dwFlags: MOUSEEVENTF_MOVE, // relative move
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }
}

fn send_left_click() {
    let down = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: 0,
                dwFlags: MOUSEEVENTF_LEFTDOWN,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let up = INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx: 0,
                dy: 0,
                mouseData: 0,
                dwFlags: MOUSEEVENTF_LEFTUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        SendInput(&[down, up], std::mem::size_of::<INPUT>() as i32);
    }
}

fn send_key(vk: VIRTUAL_KEY) {
    let down = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: KEYBD_EVENT_FLAGS(0),
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    let up = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: vk,
                wScan: 0,
                dwFlags: KEYEVENTF_KEYUP,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        SendInput(&[down, up], std::mem::size_of::<INPUT>() as i32);
    }
}

fn main() {
    // Per-controller previous button bitmask for edge detection (0..3).
    let mut prev_buttons: [u16; 4] = [0; 4];
    // F11 fired once this flight session; re-armed when Plot regains focus.
    let mut went_fullscreen = false;
    let mut was_focused = false;

    loop {
        thread::sleep(Duration::from_millis(POLL_MS));

        // Find the first connected controller.
        let mut state = XINPUT_STATE::default();
        let mut idx_found: Option<u32> = None;
        for i in 0..4u32 {
            let res = unsafe { XInputGetState(i, &mut state) };
            if res == 0 {
                idx_found = Some(i);
                break;
            }
        }
        let Some(idx) = idx_found else {
            // no pad connected
            prev_buttons = [0; 4];
            continue;
        };

        let gp = state.Gamepad;
        // wButtons is a XINPUT_GAMEPAD_BUTTON_FLAGS newtype over u16; work
        // with the raw u16 (.0) for bitmask edge detection.
        let buttons: u16 = gp.wButtons.0;

        // Only act while a Plot browser window is focused.
        let focused = plot_focused();
        if !focused {
            prev_buttons[idx as usize] = buttons; // avoid stale edge on refocus
            was_focused = false;
            continue;
        }
        if focused && !was_focused {
            went_fullscreen = false; // re-arm F11 for this session
        }
        was_focused = true;

        let prev = prev_buttons[idx as usize];
        let just_pressed = |mask: u16| (buttons & mask) != 0 && (prev & mask) == 0;

        let lx = deadzone(gp.sThumbLX as i32);
        let ly = deadzone(gp.sThumbLY as i32);
        let rx = deadzone(gp.sThumbRX as i32);
        let ry = deadzone(gp.sThumbRY as i32);

        // ── FLIGHT DETECT → F11, ONLY on the MAP ─────────────────────
        // F11 expands the MAP for flight — it has no business firing while
        // browsing the rest of the site. Only fullscreen when the map page
        // is focused and real flight input is seen.
        let flying = lx.abs() > FLIGHT_ENGAGE
            || ly.abs() > FLIGHT_ENGAGE
            || gp.bLeftTrigger > TRIGGER_ENGAGE
            || gp.bRightTrigger > TRIGGER_ENGAGE;
        if flying && !went_fullscreen && map_focused() {
            went_fullscreen = true;
            send_key(VK_F11);
        }

        // ── RIGHT STICK → OS cursor, but ONLY while LB is held ───────
        // LB is the "aim with the gamepad" gesture. By DEFAULT (LB up) the
        // right stick is left alone so the map gets it for camera look/flight.
        // Hold LB → the right stick moves the OS cursor (aim the reticle);
        // the green reticle rides the cursor, then A clicks it. This is what
        // preserves camera look — Plot Pad never steals the right stick
        // full-time. memory/project_plot_pad_os_click_helper (LB-aim model).
        let lb_held = (buttons & XINPUT_GAMEPAD_LEFT_SHOULDER.0) != 0;
        if lb_held && (rx != 0 || ry != 0) {
            let dx = ((rx as f32 / 32767.0) * CURSOR_SPEED).round() as i32;
            // XInput Y is up-positive; screen Y is down-positive → invert.
            let dy = ((-ry as f32 / 32767.0) * CURSOR_SPEED).round() as i32;
            if dx != 0 || dy != 0 {
                send_mouse_move(dx, dy);
            }
        }

        // Plot Pad's ONE job: turn A into a REAL OS click so Map3D's gmp-click
        // opens the parcel under the reticle. You aim the reticle by holding LB
        // + right stick (above); A clicks exactly where the cursor/reticle sits.
        // ── A → REAL OS left-click at the cursor ─────────────────────
        if just_pressed(XINPUT_GAMEPAD_A.0) {
            send_left_click();
        }
        // ── B → Escape (dismiss the property card) ───────────────────
        if just_pressed(XINPUT_GAMEPAD_B.0) {
            send_key(VK_ESCAPE);
        }
        // ── Start/Menu → toggle full-screen (map flight) ─────────────
        if just_pressed(XINPUT_GAMEPAD_START.0) && map_focused() {
            send_key(VK_F11);
            went_fullscreen = true;
        }

        prev_buttons[idx as usize] = buttons;
    }
}
