import { redirect } from 'next/navigation';

// /login is dead. Greg locked 2026-05-31: the only sign-in surface is
// the Flight Manifest beat inside ArrivalSequence. Any hit on /login
// bounces back to /landing so the visitor enters the cinematic.
//
// Existing inbound links (/login?next=, OAuth callback fallback,
// emails, deep links) all bounce here. The ?error=auth_failed flag
// is dropped — auth failures show up in the manifest's own UI.
export default function LoginRedirect() {
  redirect('/landing');
}
