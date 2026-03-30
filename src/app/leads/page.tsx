'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lead } from '@/types';
import { formatPhone, formatDate, timeAgo } from '@/lib/utils';
import { LEAD_STATUSES, LEAD_SOURCES } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import Tag from '@/components/ui/Tag';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import StatCard from '@/components/ui/StatCard';
import MaterialIcon from '@/components/ui/MaterialIcon';

const PAGE_SIZE = 25;

export default function LeadsPage() {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const offset = (currentPage - 1) * PAGE_SIZE;

    let query = supabase.from('leads').select('*', { count: 'exact' });

    if (searchTerm) {
      query = query.or(
        `name.ilike.%${searchTerm}%,property_address.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`
      );
    }

    if (statusFilter !== 'All') {
      query = query.eq('status', statusFilter);
    }

    if (sourceFilter !== 'All') {
      query = query.eq('source', sourceFilter);
    }

    query = query
      .order('created_at', { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);

    const { data, count, error } = await query;

    if (!error) {
      setLeads(data ?? []);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [searchTerm, statusFilter, sourceFilter, currentPage]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sourceFilter]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const rangeStart = (currentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(currentPage * PAGE_SIZE, totalCount);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === leads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map((l) => l.id)));
    }
  };

  const hotLeadsCount = leads.filter((l) => l.status === 'Hot Lead').length;
  const newCount = leads.filter((l) => l.status === 'New').length;

  // Extract city from property_address
  function extractCity(address: string | null): string {
    if (!address) return '';
    const parts = address.split(',');
    return parts.length >= 2 ? parts[parts.length - 2].trim() : '';
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.2em] text-blue-600 font-semibold">
            Portfolio Management
          </p>
          <h2 className="mt-1 text-3xl font-headline font-extrabold">
            Lead Manifest
          </h2>
        </div>

        <div className="flex items-center gap-3">
          <button className="flex items-center gap-2 rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container">
            <MaterialIcon icon="tune" className="text-[18px]" />
            Advanced Filters
          </button>
          <button className="flex items-center gap-2 rounded-xl action-gradient px-4 py-2 text-sm font-medium text-on-primary transition-shadow hover:shadow-lg">
            <MaterialIcon icon="download" className="text-[18px]" />
            Export Manifest
          </button>
        </div>
      </div>

      {/* Search / Filters + Stats */}
      <div className="mt-6 grid grid-cols-12 gap-6">
        {/* Search & Filters */}
        <div className="col-span-9 space-y-4">
          <div className="flex items-center gap-3">
            <SearchInput
              placeholder="Search by name, address, or phone..."
              onChange={setSearchTerm}
              className="flex-1"
            />

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="All">All Statuses</option>
              {LEAD_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-blue-500/40"
            >
              <option value="All">All Sources</option>
              {LEAD_SOURCES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-4 py-2.5 text-sm">
              <span className="font-medium text-blue-700">
                {selectedIds.size} selected
              </span>
              <div className="h-4 w-px bg-blue-200" />
              <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                <MaterialIcon icon="label" className="text-[16px]" />
                Add Tag
              </button>
              <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                <MaterialIcon icon="sync" className="text-[16px]" />
                Update Status
              </button>
              <button className="flex items-center gap-1 text-blue-600 hover:text-blue-800">
                <MaterialIcon icon="download" className="text-[16px]" />
                Export Selected
              </button>
            </div>
          )}
        </div>

        {/* Stats Panel */}
        <div className="col-span-3 space-y-3">
          <div className="rounded-2xl bg-surface-container-low p-5">
            <p className="text-[10px] uppercase tracking-widest text-slate-500">
              Conversion Velocity
            </p>
            <p className="mt-1 font-headline text-3xl font-extrabold">84%</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-200">
              <div className="h-full w-[84%] rounded-full bg-blue-600" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              label="New Opportunities"
              value={newCount}
              bgIcon="person_add"
            />
            <div className="relative overflow-hidden rounded-2xl bg-surface-container-low p-5">
              <MaterialIcon
                icon="local_fire_department"
                className="absolute -bottom-2 -right-2 text-[60px] text-orange-200/60"
              />
              <p className="text-[10px] uppercase tracking-widest text-slate-500">
                Hot Leads
              </p>
              <p className="mt-1 font-headline text-2xl font-extrabold">
                {hotLeadsCount}
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-slate-200">
                <div
                  className="h-full rounded-full bg-orange-500"
                  style={{
                    width: `${totalCount > 0 ? (hotLeadsCount / totalCount) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-outline-variant bg-surface-container-lowest">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-outline-variant bg-surface-container-low text-left">
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={selectedIds.size === leads.length && leads.length > 0}
                  onChange={toggleAll}
                  className="rounded"
                />
              </th>
              <th className="px-4 py-3 font-semibold text-on-surface-variant">
                Property Address
              </th>
              <th className="px-4 py-3 font-semibold text-on-surface-variant">
                Owner Entity
              </th>
              <th className="px-4 py-3 font-semibold text-on-surface-variant">
                Status
              </th>
              <th className="px-4 py-3 font-semibold text-on-surface-variant">
                Tags
              </th>
              <th className="px-4 py-3 font-semibold text-on-surface-variant">
                Source
              </th>
              <th className="px-4 py-3 font-semibold text-on-surface-variant">
                Last Contact
              </th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-outline-variant">
                    <td className="px-4 py-4" colSpan={7}>
                      <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    </td>
                  </tr>
                ))
              : leads.map((lead) => (
                  <tr
                    key={lead.id}
                    onClick={() => router.push(`/leads/${lead.id}`)}
                    className="cursor-pointer border-b border-outline-variant transition-colors hover:bg-surface-container-high"
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(lead.id)}
                        onChange={() => toggleSelect(lead.id)}
                        className="rounded"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-on-surface">
                        {lead.property_address || 'No address'}
                      </p>
                      <p className="text-xs text-secondary">
                        {extractCity(lead.property_address)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{lead.name}</p>
                      <p className="text-xs text-secondary">
                        {formatPhone(lead.phone)}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <Badge status={lead.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {lead.tags?.map((tag) => (
                          <Tag key={tag} label={tag} />
                        ))}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-secondary">
                      {lead.source ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-on-surface">
                        {formatDate(lead.updated_at)}
                      </p>
                      <p className="text-xs text-secondary">
                        {timeAgo(lead.updated_at)}
                      </p>
                    </td>
                  </tr>
                ))}

            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-secondary">
                  <MaterialIcon icon="search_off" className="text-[40px] text-slate-300" />
                  <p className="mt-2 text-lg font-medium">No leads found</p>
                  <p className="text-sm">Try adjusting your search or filters</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-outline-variant bg-surface-container-low px-4 py-3">
            <p className="text-sm text-secondary">
              Showing {rangeStart} to {rangeEnd} of {totalCount} Results
            </p>
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>
    </div>
  );
}
