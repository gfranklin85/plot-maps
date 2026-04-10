'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default function AdminPage() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [analyticsData, setAnalyticsData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch both APIs in parallel
        const [statsRes, analyticsRes] = await Promise.allSettled([
          fetch('/api/admin/stats'),
          fetch('/api/admin/analytics'),
        ]);

        // Stats is required
        if (statsRes.status === 'fulfilled') {
          const res = statsRes.value;
          if (res.status === 403 || res.status === 401) {
            setError('Access Denied');
            return;
          }
          if (!res.ok) throw new Error('Failed to load');
          setData(await res.json());
        } else {
          throw new Error('Failed to load admin data');
        }

        // Analytics is optional — graceful fallback
        if (analyticsRes.status === 'fulfilled' && analyticsRes.value.ok) {
          setAnalyticsData(await analyticsRes.value.json());
        }
      } catch {
        setError('Failed to load admin data');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="h-[calc(100vh-4rem)] flex items-center justify-center bg-surface">
        <div className="text-center">
          <p className="text-2xl font-bold text-red-400 mb-2">{error || 'Error'}</p>
          <button onClick={() => router.push('/')} className="text-primary text-sm hover:underline">
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <AdminDashboard data={data} analyticsData={analyticsData} />;
}
