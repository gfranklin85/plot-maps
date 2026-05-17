'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Signups are closed while Plot is in private beta. Anyone hitting
// /signup is redirected to /waitlist where they can leave their email.
// When the gate opens we restore the original signup form (kept in
// git history under signup/page.tsx prior to the beta gate).

export default function SignupPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/waitlist');
  }, [router]);
  return null;
}
