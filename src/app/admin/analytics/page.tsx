'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import WarRoom from '@/components/admin/WarRoom';

export default function AdminAnalyticsPage() {
  const router = useRouter();
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchAnalytics() {
      try {
        const res = await fetch('/api/admin/analytics');
        if (res.status === 403 || res.status === 401) {
          setError('Access Denied');
          return;
        }
        if (!res.ok) throw new Error('Failed to load');
        setData(await res.json());
      } catch {
        setError('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
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
          <button onClick={() => router.push('/admin')} className="text-primary text-sm hover:underline">
            Back to Admin
          </button>
        </div>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return <WarRoom data={data as any} />;
}
