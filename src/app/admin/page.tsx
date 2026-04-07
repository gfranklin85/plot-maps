'use client';

import { useEffect, useState } from 'react';
import { useProfile } from '@/lib/profile-context';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  const { profile, loading: profileLoading } = useProfile();
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (profileLoading) return;
    if (!profile.isAdmin) {
      setError('Access Denied');
      setLoading(false);
      return;
    }

    async function fetchStats() {
      try {
        const res = await fetch('/api/admin/stats');
        if (!res.ok) throw new Error('Access denied');
        setData(await res.json());
      } catch {
        setError('Failed to load admin data');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, [profile.isAdmin, profileLoading]);

  if (profileLoading || loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-[#0c1324]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-[#0c1324]">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-400 mb-2">{error || 'Error'}</p>
          <button onClick={() => router.push('/')} className="text-indigo-400 text-sm hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard data={data} />;
}
