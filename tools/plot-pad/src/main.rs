//  ██████  PLOT PAD  ██████
//  Full Gamepad Flight — the OS-level helper for plot.solutions.
//
//  A website is sandboxed. This tiny native helper is not. While a Plot
//  browser window is focused, it:
//    • A button → a REAL OS left-click AT THE RETICLE. Google Map3D's
//      gmp-click only fires on a TRUSTED (real) click — a synthetic JS
//      click does nothing. The web app tells us WHERE the reticle is (a
//      0..1 viewport fraction) over a localhost WebSocket; on A we map that
//      to a virtual-desktop absolute pixel via the focused window's client
//      rect and click EXACTLY there — cursor-independent and monitor-
//      independent. Google then returns the exact ground lat/lng under the
//      reticle → pixel-perfect parcel selection at any flight angle.
//      (No WS client connected → falls back to a click at the current cursor.)
//    • First flight input (stick/trigger) → presses F11 once → the browser
//      goes true full-screen, chrome off, map fills the glass.
//    • LB + right stick → moves the OS cursor (aim), so the reticle aims.
//    • B → Escape (close the property card).  Start/Menu → F11 toggle.
//
//  It reads the pad only while a Plot window is foreground, so it never
//  hijacks the rest of the machine. The WS server binds to 127.0.0.1 ONLY
//  (loopback — never network-exposed).
//
//  Native Win32 (XInput + SendInput) + a hand-rolled localhost WebSocket
//  (std::net, no external crates) — no runtime, tiny signed .exe.
//  © Plot Solutions LLC.  memory/project_plot_pad_os_click_helper
//
//  Build:  cargo build --release   →   target/release/PlotPad.exe

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::{thread, time::Duration};

use windows::Win32::Foundation::{HWND, MAX_PATH, POINT, RECT};
use windows::Win32::System::Threading::{
    OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
    PROCESS_QUERY_LIMITED_INFORMATION,
};
use windows::Win32::UI::HiDpi::{
    SetProcessDpiAwarenessContext, DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2,
};
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, INPUT_MOUSE, KEYBDINPUT,
    KEYBD_EVENT_FLAGS, KEYEVENTF_KEYUP, MOUSEEVENTF_ABSOLUTE, MOUSEEVENTF_LEFTDOWN,
    MOUSEEVENTF_LEFTUP, MOUSEEVENTF_MOVE, MOUSEEVENTF_VIRTUALDESK, MOUSEINPUT,
    VIRTUAL_KEY, VK_ESCAPE, VK_F11,
};
use windows::Win32::UI::Input::XboxController::{
    XInputGetState, XINPUT_GAMEPAD_A, XINPUT_GAMEPAD_B, XINPUT_GAMEPAD_LEFT_SHOULDER,
    XINPUT_GAMEPAD_START, XINPUT_STATE,
};
use windows::Win32::Graphics::Gdi::ClientToScreen;
use windows::Win32::UI::WindowsAndMessaging::{
    GetClientRect, GetForegroundWindow, GetSystemMetrics, GetWindowTextW,
    GetWindowThreadProcessId, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN, SM_XVIRTUALSCREEN,
    SM_YVIRTUALSCREEN,
};

// ── Tuning ────────────────────────────────────────────────────────────
const VERSION: &str = "0.2.0";
const POLL_MS: u64 = 8; // ~120 Hz
const DEADZONE: i32 = 8000; // XInput axis is -32768..32767
const FLIGHT_ENGAGE: i32 = 12000; // stick magnitude that counts as "flying"
const TRIGGER_ENGAGE: u8 = 40; // trigger value that counts as throttle/climb
const CURSOR_SPEED: f32 = 18.0; // px per poll at full right-stick deflection
// Shared port ladder — the web client tries these in the SAME order.
const PORT_LADDER: &[u16] = &[47600, 47601, 47602, 47603];

// Window titles / process names that mean "this is Plot". Substring, lower.
const TITLE_HINTS: &[&str] = &[
    "plot.solutions",
    "plot maps",
    "plotmaps",
    "/map",
    "plot pad",
    "localhost",
];
const BROWSER_HINTS: &[&str] = &[
    "chrome.exe",
    "msedge.exe",
    "firefox.exe",
    "brave.exe",
    "opera.exe",
    "vivaldi.exe",
    "code.exe",
    "arc.exe",
];

// ── Shared state between the WS thread(s) and the poll loop ────────────
// The latest reticle fraction the web app reported, and whether ANY client
// is currently connected. The poll loop reads these on A-press.
struct Shared {
    // Reticle position as a 0..1 viewport fraction. None until first report.
    reticle: Mutex<Option<(f32, f32)>>,
    // At least one WS client connected right now.
    connected: AtomicBool,
    // Registered client sockets we can push messages to (clicked/error).
    clients: Mutex<Vec<TcpStream>>,
}

impl Shared {
    fn new() -> Self {
        Shared {
            reticle: Mutex::new(None),
            connected: AtomicBool::new(false),
            clients: Mutex::new(Vec::new()),
        }
    }

    /// Broadcast a text frame to every connected client (best-effort).
    fn broadcast(&self, msg: &str) {
        let frame = ws_encode_text(msg);
        let mut clients = self.clients.lock().unwrap();
        clients.retain_mut(|s| s.write_all(&frame).is_ok());
        if clients.is_empty() {
            self.connected.store(false, Ordering::SeqCst);
        }
    }
}

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

/// True only when the MAP page is focused (F11 fullscreen is map-only).
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
                dwFlags: MOUSEEVENTF_MOVE, // relative move (LB-aim)
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };
    unsafe {
        SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    }
}

/// Fallback: click at the CURRENT cursor (used when no WS client connected).
fn send_left_click() {
    let down = mouse_input(0, 0, MOUSEEVENTF_LEFTDOWN);
    let up = mouse_input(0, 0, MOUSEEVENTF_LEFTUP);
    unsafe {
        SendInput(&[down, up], std::mem::size_of::<INPUT>() as i32);
    }
}

/// The real deal: ABSOLUTE virtual-desktop move to (nx,ny in 0..65535) then
/// click — lands EXACTLY on the reticle regardless of where the cursor was
/// or which monitor. Batched so move+down+up are atomic at the target.
fn send_absolute_click(nx: i32, ny: i32) {
    let flags_move = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    let flags_down = MOUSEEVENTF_LEFTDOWN | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    let flags_up = MOUSEEVENTF_LEFTUP | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK;
    let inputs = [
        mouse_input(nx, ny, flags_move),
        mouse_input(nx, ny, flags_down),
        mouse_input(nx, ny, flags_up),
    ];
    unsafe {
        SendInput(&inputs, std::mem::size_of::<INPUT>() as i32);
    }
}

fn mouse_input(dx: i32, dy: i32, flags: windows::Win32::UI::Input::KeyboardAndMouse::MOUSE_EVENT_FLAGS) -> INPUT {
    INPUT {
        r#type: INPUT_MOUSE,
        Anonymous: INPUT_0 {
            mi: MOUSEINPUT {
                dx,
                dy,
                mouseData: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
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

/// Map a 0..1 viewport fraction to a virtual-desktop ABSOLUTE coordinate
/// (0..65535) using the FOREGROUND window's real client rect. Returns None
/// if there's no valid window. Requires PER_MONITOR_AWARE_V2 (set at start)
/// so client + virtual-screen metrics are both physical pixels.
fn fraction_to_abs(fx: f32, fy: f32) -> Option<(i32, i32)> {
    unsafe {
        let hwnd = GetForegroundWindow();
        if hwnd.0.is_null() {
            return None;
        }
        // Client area size (physical px; origin is (0,0)).
        let mut rc = RECT::default();
        if GetClientRect(hwnd, &mut rc).is_err() {
            return None;
        }
        let cw = (rc.right - rc.left) as f32;
        let ch = (rc.bottom - rc.top) as f32;
        if cw <= 0.0 || ch <= 0.0 {
            return None;
        }
        // Client top-left → screen (physical px).
        let mut origin = POINT { x: 0, y: 0 };
        if ClientToScreen(hwnd, &mut origin).as_bool() == false {
            return None;
        }
        let tx = origin.x as f32 + (fx.clamp(0.0, 1.0) * cw);
        let ty = origin.y as f32 + (fy.clamp(0.0, 1.0) * ch);

        // Normalize to the whole virtual desktop, 0..65535 inclusive.
        let vx0 = GetSystemMetrics(SM_XVIRTUALSCREEN) as f32;
        let vy0 = GetSystemMetrics(SM_YVIRTUALSCREEN) as f32;
        let vw = GetSystemMetrics(SM_CXVIRTUALSCREEN) as f32;
        let vh = GetSystemMetrics(SM_CYVIRTUALSCREEN) as f32;
        if vw <= 1.0 || vh <= 1.0 {
            return None;
        }
        let nx = (((tx - vx0) * 65535.0) / (vw - 1.0)).round() as i32;
        let ny = (((ty - vy0) * 65535.0) / (vh - 1.0)).round() as i32;
        Some((nx.clamp(0, 65535), ny.clamp(0, 65535)))
    }
}

// ── Hand-rolled localhost WebSocket (RFC 6455, text frames only) ───────

/// Encode a text payload as a single unmasked server→client WS frame.
fn ws_encode_text(payload: &str) -> Vec<u8> {
    let bytes = payload.as_bytes();
    let mut frame = Vec::with_capacity(bytes.len() + 4);
    frame.push(0x81); // FIN + text opcode
    let len = bytes.len();
    if len < 126 {
        frame.push(len as u8);
    } else if len < 65536 {
        frame.push(126);
        frame.extend_from_slice(&(len as u16).to_be_bytes());
    } else {
        frame.push(127);
        frame.extend_from_slice(&(len as u64).to_be_bytes());
    }
    frame.extend_from_slice(bytes);
    frame
}

/// Read one client→server text frame from the stream. Returns the decoded
/// UTF-8 payload, or None on close/error. Handles masking + fragmentation-
/// free small frames (browsers send our tiny JSON unfragmented).
fn ws_read_text(stream: &mut TcpStream) -> Option<String> {
    let mut hdr = [0u8; 2];
    stream.read_exact(&mut hdr).ok()?;
    let opcode = hdr[0] & 0x0f;
    if opcode == 0x8 {
        return None; // close
    }
    let masked = (hdr[1] & 0x80) != 0;
    let mut len = (hdr[1] & 0x7f) as usize;
    if len == 126 {
        let mut ext = [0u8; 2];
        stream.read_exact(&mut ext).ok()?;
        len = u16::from_be_bytes(ext) as usize;
    } else if len == 127 {
        let mut ext = [0u8; 8];
        stream.read_exact(&mut ext).ok()?;
        len = u64::from_be_bytes(ext) as usize;
    }
    let mut mask = [0u8; 4];
    if masked {
        stream.read_exact(&mut mask).ok()?;
    }
    // Guard against absurd payloads (our messages are tiny).
    if len > 4096 {
        return None;
    }
    let mut data = vec![0u8; len];
    stream.read_exact(&mut data).ok()?;
    if masked {
        for (i, b) in data.iter_mut().enumerate() {
            *b ^= mask[i % 4];
        }
    }
    if opcode == 0x1 {
        String::from_utf8(data).ok()
    } else {
        // ping/pong/binary — ignore, return empty so caller keeps looping.
        Some(String::new())
    }
}

/// Perform the HTTP→WS upgrade handshake. Returns true on success.
fn ws_handshake(stream: &mut TcpStream) -> bool {
    // Read request headers (until CRLFCRLF).
    let mut buf = Vec::new();
    let mut byte = [0u8; 1];
    loop {
        if stream.read_exact(&mut byte).is_err() {
            return false;
        }
        buf.push(byte[0]);
        if buf.len() >= 4 && &buf[buf.len() - 4..] == b"\r\n\r\n" {
            break;
        }
        if buf.len() > 8192 {
            return false;
        }
    }
    let req = String::from_utf8_lossy(&buf);
    // Find Sec-WebSocket-Key.
    let key = req
        .lines()
        .find_map(|l| {
            let l = l.trim();
            let lower = l.to_ascii_lowercase();
            if lower.starts_with("sec-websocket-key:") {
                Some(l[l.find(':').unwrap() + 1..].trim().to_string())
            } else {
                None
            }
        });
    let Some(key) = key else { return false };
    let accept = ws_accept_key(&key);
    let resp = format!(
        "HTTP/1.1 101 Switching Protocols\r\n\
         Upgrade: websocket\r\n\
         Connection: Upgrade\r\n\
         Sec-WebSocket-Accept: {}\r\n\r\n",
        accept
    );
    stream.write_all(resp.as_bytes()).is_ok()
}

/// Sec-WebSocket-Accept = base64(SHA1(key + magic GUID)).
fn ws_accept_key(key: &str) -> String {
    const MAGIC: &str = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
    let mut input = String::with_capacity(key.len() + MAGIC.len());
    input.push_str(key);
    input.push_str(MAGIC);
    let digest = sha1(input.as_bytes());
    base64_encode(&digest)
}

// ── Inline SHA-1 (RFC 3174) — no external crate ───────────────────────
fn sha1(data: &[u8]) -> [u8; 20] {
    let mut h: [u32; 5] = [0x67452301, 0xEFCDAB89, 0x98BADCFE, 0x10325476, 0xC3D2E1F0];
    let ml = (data.len() as u64) * 8;
    let mut msg = data.to_vec();
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&ml.to_be_bytes());

    for chunk in msg.chunks(64) {
        let mut w = [0u32; 80];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                chunk[i * 4],
                chunk[i * 4 + 1],
                chunk[i * 4 + 2],
                chunk[i * 4 + 3],
            ]);
        }
        for i in 16..80 {
            w[i] = (w[i - 3] ^ w[i - 8] ^ w[i - 14] ^ w[i - 16]).rotate_left(1);
        }
        let (mut a, mut b, mut c, mut d, mut e) = (h[0], h[1], h[2], h[3], h[4]);
        for (i, &wi) in w.iter().enumerate() {
            let (f, k) = match i {
                0..=19 => ((b & c) | ((!b) & d), 0x5A827999u32),
                20..=39 => (b ^ c ^ d, 0x6ED9EBA1),
                40..=59 => ((b & c) | (b & d) | (c & d), 0x8F1BBCDC),
                _ => (b ^ c ^ d, 0xCA62C1D6),
            };
            let tmp = a
                .rotate_left(5)
                .wrapping_add(f)
                .wrapping_add(e)
                .wrapping_add(k)
                .wrapping_add(wi);
            e = d;
            d = c;
            c = b.rotate_left(30);
            b = a;
            a = tmp;
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
    }
    let mut out = [0u8; 20];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

fn base64_encode(data: &[u8]) -> String {
    const T: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = String::new();
    for chunk in data.chunks(3) {
        let b = [
            chunk[0],
            *chunk.get(1).unwrap_or(&0),
            *chunk.get(2).unwrap_or(&0),
        ];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | (b[2] as u32);
        out.push(T[((n >> 18) & 63) as usize] as char);
        out.push(T[((n >> 12) & 63) as usize] as char);
        out.push(if chunk.len() > 1 { T[((n >> 6) & 63) as usize] as char } else { '=' });
        out.push(if chunk.len() > 2 { T[(n & 63) as usize] as char } else { '=' });
    }
    out
}

// ── Tiny JSON field extraction (our messages are flat + fixed-shape) ───

/// Extract a string field value (unescaped simple) — e.g. json_str(s,"type").
fn json_str(src: &str, key: &str) -> Option<String> {
    let pat = format!("\"{}\"", key);
    let i = src.find(&pat)? + pat.len();
    let rest = &src[i..];
    let colon = rest.find(':')?;
    let after = rest[colon + 1..].trim_start();
    if !after.starts_with('"') {
        return None;
    }
    let after = &after[1..];
    let end = after.find('"')?;
    Some(after[..end].to_string())
}

/// Extract a numeric field value — e.g. json_num(s,"x").
fn json_num(src: &str, key: &str) -> Option<f32> {
    let pat = format!("\"{}\"", key);
    let i = src.find(&pat)? + pat.len();
    let rest = &src[i..];
    let colon = rest.find(':')?;
    let after = rest[colon + 1..].trim_start();
    let end = after
        .find(|c: char| !(c.is_ascii_digit() || c == '.' || c == '-' || c == '+' || c == 'e' || c == 'E'))
        .unwrap_or(after.len());
    after[..end].parse::<f32>().ok()
}

/// Handle one connected client for its lifetime: handshake, hello, then read
/// reticle updates into the shared state.
fn handle_client(mut stream: TcpStream, shared: Arc<Shared>) {
    if !ws_handshake(&mut stream) {
        return;
    }
    // Register a clone for server→client pushes (clicked/error).
    if let Ok(clone) = stream.try_clone() {
        shared.clients.lock().unwrap().push(clone);
    }
    shared.connected.store(true, Ordering::SeqCst);

    // Greet — lights the web indicator truthfully (plot:pad-hello).
    let hello = format!("{{\"type\":\"hello\",\"version\":\"{}\"}}", VERSION);
    let _ = stream.write_all(&ws_encode_text(&hello));

    loop {
        match ws_read_text(&mut stream) {
            Some(text) if text.is_empty() => continue, // ping/pong/ignored
            Some(text) => {
                if json_str(&text, "type").as_deref() == Some("reticle") {
                    if let (Some(x), Some(y)) = (json_num(&text, "x"), json_num(&text, "y")) {
                        *shared.reticle.lock().unwrap() = Some((x, y));
                    }
                }
            }
            None => break, // closed
        }
    }
    // Client gone — if no clients remain, mark disconnected.
    let mut clients = shared.clients.lock().unwrap();
    // (We can't cheaply identify our own clone; a broadcast prunes dead ones.
    // Just re-evaluate connected on the next broadcast; conservatively clear
    // if this was the last handler and the list is now unwritable.)
    clients.retain_mut(|s| s.write_all(&ws_encode_text("{\"type\":\"ping\"}")).is_ok());
    if clients.is_empty() {
        shared.connected.store(false, Ordering::SeqCst);
    }
}

/// Bind the WS server on the first free port in the ladder; accept forever.
fn start_ws_server(shared: Arc<Shared>) {
    let mut listener: Option<TcpListener> = None;
    for &port in PORT_LADDER {
        if let Ok(l) = TcpListener::bind(("127.0.0.1", port)) {
            listener = Some(l);
            break;
        }
    }
    let Some(listener) = listener else { return };
    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            let _ = stream.set_nodelay(true);
            let sh = Arc::clone(&shared);
            thread::spawn(move || handle_client(stream, sh));
        }
    }
}

fn main() {
    // PER-MONITOR DPI aware FIRST — so client-rect + virtual-screen coords are
    // both physical pixels and the absolute click lands right on scaled displays.
    unsafe {
        let _ = SetProcessDpiAwarenessContext(DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2);
    }

    let shared = Arc::new(Shared::new());
    {
        let sh = Arc::clone(&shared);
        thread::spawn(move || start_ws_server(sh));
    }

    // Per-controller previous button bitmask for edge detection (0..3).
    let mut prev_buttons: [u16; 4] = [0; 4];
    let mut went_fullscreen = false;
    let mut was_focused = false;

    loop {
        thread::sleep(Duration::from_millis(POLL_MS));

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
            prev_buttons = [0; 4];
            continue;
        };

        let gp = state.Gamepad;
        let buttons: u16 = gp.wButtons.0;

        let focused = plot_focused();
        if !focused {
            prev_buttons[idx as usize] = buttons;
            was_focused = false;
            continue;
        }
        if focused && !was_focused {
            went_fullscreen = false;
        }
        was_focused = true;

        let prev = prev_buttons[idx as usize];
        let just_pressed = |mask: u16| (buttons & mask) != 0 && (prev & mask) == 0;

        let lx = deadzone(gp.sThumbLX as i32);
        let ly = deadzone(gp.sThumbLY as i32);
        let rx = deadzone(gp.sThumbRX as i32);
        let ry = deadzone(gp.sThumbRY as i32);

        // ── FLIGHT DETECT → F11, ONLY on the MAP ─────────────────────
        let flying = lx.abs() > FLIGHT_ENGAGE
            || ly.abs() > FLIGHT_ENGAGE
            || gp.bLeftTrigger > TRIGGER_ENGAGE
            || gp.bRightTrigger > TRIGGER_ENGAGE;
        if flying && !went_fullscreen && map_focused() {
            went_fullscreen = true;
            send_key(VK_F11);
        }

        // ── LB + right stick → OS cursor (aim), relative move ────────
        let lb_held = (buttons & XINPUT_GAMEPAD_LEFT_SHOULDER.0) != 0;
        if lb_held && (rx != 0 || ry != 0) {
            let dx = ((rx as f32 / 32767.0) * CURSOR_SPEED).round() as i32;
            let dy = ((-ry as f32 / 32767.0) * CURSOR_SPEED).round() as i32;
            if dx != 0 || dy != 0 {
                send_mouse_move(dx, dy);
            }
        }

        // ── A → REAL OS click AT THE RETICLE (WS) or at cursor (fallback) ─
        if just_pressed(XINPUT_GAMEPAD_A.0) {
            let reticle = *shared.reticle.lock().unwrap();
            let connected = shared.connected.load(Ordering::SeqCst);
            match (connected, reticle) {
                (true, Some((fx, fy))) => {
                    if let Some((nx, ny)) = fraction_to_abs(fx, fy) {
                        send_absolute_click(nx, ny);
                        shared.broadcast("{\"type\":\"clicked\"}");
                    } else {
                        send_left_click(); // geometry unavailable → cursor
                    }
                }
                // No web link (or no reticle yet) → today's behavior.
                _ => send_left_click(),
            }
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
