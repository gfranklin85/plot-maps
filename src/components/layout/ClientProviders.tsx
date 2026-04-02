'use client';

import { ProfileProvider } from '@/lib/profile-context';
import type { ReactNode } from 'react';

export default function ClientProviders({ children }: { children: ReactNode }) {
  return <ProfileProvider>{children}</ProfileProvider>;
}
