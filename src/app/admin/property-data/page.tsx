'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface SourceInfo {
  id: string;
  description: string;
  kind: string;
  licenseReference: string;
  contributes: string[];
  supportsSnapshot: boolean;
}

interface RegionInfo {
  state: string;
  city: string;
  parcelCount: number;
}

interface IngestInfo {
  id: string;
  source_id: string;
  source_kind: string;
  source_description: string;
  records_ingested: number | null;
  records_updated: number | null;
  license_reference: string;
  started_at: string;
  finished_at: string | null;
}

interface CoverageData {
  sources: SourceInfo[];
  regions: RegionInfo[];
  ingests: IngestInfo[];
}

export default function PropertyDataAdminPage() {
  const [data, setData] = useState<CoverageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [runningSourceId, setRunningSourceId] = useState<string | null>(null);
  const [tab, setTab] = useState<'sources' | 'regions' | 'log'>('sources');

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/property-data/coverage');
      if (res.status === 403 || res.status === 401) {
        setError('Access Denied');
        return;
      }
      if (!res.ok) throw new Error('Failed to load');
      setData(await res.json());
    } catch {
      setError('Failed to load coverage data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const runSnapshot = useCallback(async (sourceId: string) => {
    if (!confirm(`Run snapshot for ${sourceId}? This pulls the full dataset and may take a few minutes.`)) return;
    setRunningSourceId(sourceId);
    try {
      const res = await fetch('/api/admin/property-data/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceId }),
      });
      const result = await res.json();
      if (!res.ok) {
        alert(`Snapshot failed: ${result.error ?? result.detail ?? 'unknown error'}`);
      } else {
        alert(`Snapshot complete. Ingested ${result.recordsIngested}, updated ${result.recordsUpdated}.`);
      }
      await load();
    } catch (err) {
      alert(`Snapshot failed: ${err instanceof Error ? err.message : 'unknown'}`);
    } finally {
      setRunningSourceId(null);
    }
  }, [load]);

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
          <Link href="/admin" className="text-primary text-sm hover:underline">Back to Admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 bg-surface min-h-[calc(100vh-4rem)] space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-on-surface flex items-center gap-2">
            <MaterialIcon icon="layers" className="text-primary" />
            Property Data Coverage
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Sources, loaded regions, and ingest history for Plot-owned parcel data.
          </p>
        </div>
        <Link href="/admin" className="text-sm text-primary hover:underline flex items-center gap-1">
          <MaterialIcon icon="arrow_back" className="text-sm" /> Back to Admin
        </Link>
      </div>

      {/* Tab strip */}
      <div className="flex gap-2 border-b border-outline-variant">
        {(['sources', 'regions', 'log'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t
                ? 'text-primary border-b-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {t === 'sources' ? 'Sources' : t === 'regions' ? 'Loaded Regions' : 'Ingest Log'}
          </button>
        ))}
      </div>

      {tab === 'sources' && (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-container">
              <tr className="text-on-surface-variant text-xs">
                <th className="text-left py-3 px-4 font-medium">ID</th>
                <th className="text-left py-3 px-4 font-medium">Kind</th>
                <th className="text-left py-3 px-4 font-medium">Contributes</th>
                <th className="text-left py-3 px-4 font-medium">License</th>
                <th className="text-right py-3 px-4 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {data.sources.map(s => (
                <tr key={s.id} className="border-t border-outline-variant/50">
                  <td className="py-3 px-4">
                    <div className="font-mono text-on-surface text-xs">{s.id}</div>
                    <div className="text-on-surface-variant text-[11px] mt-0.5">{s.description}</div>
                  </td>
                  <td className="py-3 px-4 text-on-surface-variant text-xs">{s.kind}</td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {s.contributes.map(c => (
                        <span key={c} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {c}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-on-surface-variant text-[11px] max-w-xs truncate" title={s.licenseReference}>
                    {s.licenseReference}
                  </td>
                  <td className="py-3 px-4 text-right">
                    {s.supportsSnapshot ? (
                      <button
                        onClick={() => runSnapshot(s.id)}
                        disabled={runningSourceId !== null}
                        className="text-xs px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:opacity-90 disabled:opacity-50"
                      >
                        {runningSourceId === s.id ? 'Running…' : 'Run snapshot'}
                      </button>
                    ) : (
                      <span className="text-[11px] text-on-surface-variant/60">live only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'regions' && (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low overflow-hidden">
          {data.regions.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              No regions loaded yet. Run a snapshot from the Sources tab to ingest your first city.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-container">
                <tr className="text-on-surface-variant text-xs">
                  <th className="text-left py-3 px-4 font-medium">State</th>
                  <th className="text-left py-3 px-4 font-medium">City</th>
                  <th className="text-right py-3 px-4 font-medium">Parcels</th>
                </tr>
              </thead>
              <tbody>
                {data.regions.map(r => (
                  <tr key={`${r.state}/${r.city}`} className="border-t border-outline-variant/50">
                    <td className="py-3 px-4 text-on-surface">{r.state}</td>
                    <td className="py-3 px-4 text-on-surface">{r.city}</td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface">{r.parcelCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'log' && (
        <div className="rounded-2xl border border-outline-variant bg-surface-container-low overflow-hidden">
          {data.ingests.length === 0 ? (
            <div className="p-8 text-center text-on-surface-variant text-sm">
              No ingests yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-container">
                <tr className="text-on-surface-variant text-xs">
                  <th className="text-left py-3 px-4 font-medium">Started</th>
                  <th className="text-left py-3 px-4 font-medium">Source</th>
                  <th className="text-right py-3 px-4 font-medium">Ingested</th>
                  <th className="text-right py-3 px-4 font-medium">Updated</th>
                  <th className="text-left py-3 px-4 font-medium">License</th>
                </tr>
              </thead>
              <tbody>
                {data.ingests.map(i => (
                  <tr key={i.id} className="border-t border-outline-variant/50">
                    <td className="py-3 px-4 text-on-surface-variant text-xs font-mono">
                      {new Date(i.started_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono text-on-surface text-xs">{i.source_id}</div>
                      <div className="text-on-surface-variant text-[11px]">{i.source_kind}</div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface text-xs">
                      {i.records_ingested?.toLocaleString() ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-on-surface-variant text-xs">
                      {i.records_updated?.toLocaleString() ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-on-surface-variant text-[11px] max-w-md truncate" title={i.license_reference}>
                      {i.license_reference}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
