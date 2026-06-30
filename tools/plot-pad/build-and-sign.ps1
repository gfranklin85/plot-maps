# ── Plot Pad: build + EV-sign + publish ───────────────────────────────
#
# Produces a SIGNED PlotPad.exe and drops it at public/download/PlotPad.exe
# so the landing hero's download has zero SmartScreen "unknown publisher"
# warning (EV cert → instant trust).
#
# Signing uses CLOUD HSM (no physical token) via SSL.com eSigner's
# CodeSignTool. Credentials come from env vars — NOTHING secret is committed.
#
# Entity: Plot Solutions LLC (the software publisher).
# memory/project_plot_pad_os_click_helper, feedback_no_company_stage_gating
#
# ── One-time setup (you) ──────────────────────────────────────────────
#  1. EV code-signing cert issued to Plot Solutions LLC via SSL.com (cloud).
#  2. Download CodeSignTool: https://www.ssl.com/guide/esigner-codesigntool-command-guide/
#     and set $env:CODE_SIGN_TOOL_HOME to its folder.
#  3. Set these env vars (e.g. in a local, gitignored .env.signing.ps1):
#       $env:ESIGNER_USERNAME   = "<ssl.com account user>"
#       $env:ESIGNER_PASSWORD   = "<ssl.com account password>"
#       $env:ESIGNER_CREDENTIAL_ID = "<credential id from SSL.com>"
#       $env:ESIGNER_TOTP_SECRET   = "<TOTP secret for automated 2FA>"
#
# ── Usage ─────────────────────────────────────────────────────────────
#   pwsh tools/plot-pad/build-and-sign.ps1            # build + sign + publish
#   pwsh tools/plot-pad/build-and-sign.ps1 -NoSign    # build + publish UNSIGNED
#                                                       (for local testing)

param(
    [switch]$NoSign
)

$ErrorActionPreference = 'Stop'
$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$root   = Resolve-Path (Join-Path $here '..\..')
$cargo  = Join-Path $env:USERPROFILE '.cargo\bin\cargo.exe'
$exeOut = Join-Path $here 'target\release\PlotPad.exe'
$pubDir = Join-Path $root 'public\download'
$pubExe = Join-Path $pubDir 'PlotPad.exe'

Write-Host "[plot-pad] building release binary..." -ForegroundColor Cyan
& $cargo build --release --manifest-path (Join-Path $here 'Cargo.toml')
if (-not (Test-Path $exeOut)) { throw "build failed: $exeOut not found" }
$kb = [math]::Round((Get-Item $exeOut).Length / 1KB, 0)
Write-Host "[plot-pad] built PlotPad.exe ($kb KB)" -ForegroundColor Green

if ($NoSign) {
    Write-Host "[plot-pad] -NoSign: skipping EV signing (UNSIGNED build)." -ForegroundColor Yellow
} else {
    # ── EV sign via SSL.com eSigner CodeSignTool (cloud HSM) ──────────
    $cst = $env:CODE_SIGN_TOOL_HOME
    if (-not $cst) { throw "CODE_SIGN_TOOL_HOME not set — see header for setup." }
    foreach ($v in 'ESIGNER_USERNAME','ESIGNER_PASSWORD','ESIGNER_CREDENTIAL_ID','ESIGNER_TOTP_SECRET') {
        if (-not (Get-Item "env:$v" -ErrorAction SilentlyContinue)) {
            throw "env var $v not set — see header for setup."
        }
    }
    $codeSign = Join-Path $cst 'CodeSignTool.bat'
    Write-Host "[plot-pad] EV-signing via SSL.com eSigner (cloud HSM)..." -ForegroundColor Cyan
    & $codeSign sign `
        -username        $env:ESIGNER_USERNAME `
        -password        $env:ESIGNER_PASSWORD `
        -credential_id   $env:ESIGNER_CREDENTIAL_ID `
        -totp_secret     $env:ESIGNER_TOTP_SECRET `
        -input_file_path $exeOut `
        -override
    if ($LASTEXITCODE -ne 0) { throw "eSigner signing failed (exit $LASTEXITCODE)" }
    Write-Host "[plot-pad] signed OK." -ForegroundColor Green
}

# ── Publish to public/download ────────────────────────────────────────
if (-not (Test-Path $pubDir)) { New-Item -ItemType Directory -Force -Path $pubDir | Out-Null }
Copy-Item $exeOut $pubExe -Force
Write-Host "[plot-pad] published → public/download/PlotPad.exe" -ForegroundColor Green

# ── Verify signature (when signed) ────────────────────────────────────
if (-not $NoSign) {
    $sig = Get-AuthenticodeSignature $pubExe
    Write-Host "[plot-pad] signature status: $($sig.Status)" -ForegroundColor Cyan
    if ($sig.SignerCertificate) {
        Write-Host "[plot-pad] signed by: $($sig.SignerCertificate.Subject)" -ForegroundColor Cyan
    }
    if ($sig.Status -ne 'Valid') { throw "signature not Valid: $($sig.Status)" }
}

Write-Host "[plot-pad] done." -ForegroundColor Green
