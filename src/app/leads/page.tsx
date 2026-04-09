'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { Lead, LeadStatus, PRIORITY_COLORS } from '@/types';
import { formatPhone, formatDate, timeAgo } from '@/lib/utils';
import { LEAD_STATUSES, LEAD_SOURCES, PRIORITIES } from '@/lib/constants';
import Badge from '@/components/ui/Badge';
import SearchInput from '@/components/ui/SearchInput';
import Pagination from '@/components/ui/Pagination';
import MaterialIcon from '@/components/ui/MaterialIcon';
import BulkActionBar from '@/components/leads/BulkActionBar';
import ExportModal from '@/components/leads/ExportModal';

const PAGE_SIZE = 25;

type SortColumn = 'created_at' | 'name' | 'property_address' | 'status' | 'source' | 'follow_up_date' | 'last_contact_date' | 'priority' | 'city';
type SortDirection = 'asc' | 'desc';

export default function LeadsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sourceFilter, setSourceFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [sortColumn, setSortColumn] = useState<SortColumn>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [allFilteredIds, setAllFilteredIds] = useState<string[]>([]);

  const fetchLeads = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    const offset = (currentPage - 1) * PAGE_SIZE;

    let query = supabase.from('leads').select('*', { count: 'exact' }).eq('user_id', user.id);

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

    if (priorityFilter !== 'All') {
      query = query.eq('priority', priorityFilter);
    }

    query = query
      .order(sortColumn, { ascending: sortDirection === 'asc' })
      .range(offset, offset + PAGE_SIZE - 1);

    const { data, count, error } = await query;

    if (!error) {
      setLeads(data ?? []);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [user, searchTerm, statusFilter, sourceFilter, priorityFilter, currentPage, sortColumn, sortDirection]);

  // Fetch all filtered IDs for export (separate lightweight query)
  const fetchAllFilteredIds = useCallback(async () => {
    if (!user) return;

    let query = supabase.from('leads').select('id').eq('user_id', user.id);

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
    if (priorityFilter !== 'All') {
      query = query.eq('priority', priorityFilter);
    }

    const { data } = await query;
    setAllFilteredIds((data ?? []).map((r) => r.id));
  }, [user, searchTerm, statusFilter, sourceFilter, priorityFilter]);

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  useEffect(() => {
    fetchAllFilteredIds();
  }, [fetchAllFilteredIds]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sourceFilter, priorityFilter]);

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

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const handleBulkStatusUpdate = async (status: LeadStatus) => {
    const ids = Array.from(selectedIds);
    await supabase.from('leads').update({ status }).in('id', ids).eq('user_id', user?.id);
    setSelectedIds(new Set());
    fetchLeads();
  };

  const handleBulkTagAdd = async (tag: string) => {
    const ids = Array.from(selectedIds);
    // For each selected lead, append the tag
    const leadsToUpdate = leads.filter((l) => ids.includes(l.id));
    const updates = leadsToUpdate.map((lead) => {
      const existingTags = lead.tags ?? [];
      if (existingTags.includes(tag)) return null;
      return supabase
        .from('leads')
        .update({ tags: [...existingTags, tag] })
        .eq('id', lead.id)
        .eq('user_id', user?.id);
    });
    await Promise.all(updates.filter(Boolean));
    fetchLeads();
  };

  const SortHeader = ({ column, label }: { column: SortColumn; label: string }) => (
    <th
      className="px-4 py-3 font-semibold text-on-surface-variant cursor-pointer select-none hover:text-on-surface transition-colors"
      onClick={() => handleSort(column)}
    >
      <div className="flex items-center gap-1">
        {label}
        {sortColumn === column && (
          <MaterialIcon
            icon={sortDirection === 'asc' ? 'arrow_upward' : 'arrow_downward'}
            className="text-[14px] text-primary"
          />
        )}
      </div>
    </th>
  );

  return (
    <div className="p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight text-on-surface">Leads</h1>
        <div className="flex items-center gap-3">
          <a href="/imports" className="flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface font-semibold rounded-lg hover:bg-surface-container-high transition-colors text-sm">
            <MaterialIcon icon="upload" className="text-[16px]" />
            Import
          </a>
          <button
            onClick={() => setExportModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-surface-container text-on-surface font-semibold rounded-lg hover:bg-surface-container-high transition-colors text-sm"
          >
            <MaterialIcon icon="download" className="text-[16px]" />
            Export
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex items-center gap-3">
        <SearchInput
          placeholder="Search address, owner, phone..."
          onChange={setSearchTerm}
          className="flex-1"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="All">Status: All</option>
          {LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="All">Source: All</option>
          {LEAD_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-card-border bg-card px-3 py-2 text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
        >
          <option value="All">Priority: All</option>
          {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
        </select>
      </div>

      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <BulkActionBar
          selectedIds={selectedIds}
          onStatusUpdate={handleBulkStatusUpdate}
          onTagAdd={handleBulkTagAdd}
          onExport={() => setExportModalOpen(true)}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-card-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-card-border bg-surface-container-low">
                <th className="w-10 px-6 py-4">
                  <input type="checkbox" checked={selectedIds.size === leads.length && leads.length > 0} onChange={toggleAll} className="rounded border-card-border" />
                </th>
                <SortHeader column="property_address" label="Address / Contact" />
                <SortHeader column="name" label="Owner" />
                <SortHeader column="status" label="Status" />
                <SortHeader column="priority" label="Priority" />
                <SortHeader column="source" label="Source" />
                <SortHeader column="last_contact_date" label="Last Contact" />
                <SortHeader column="follow_up_date" label="Follow-up" />
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <tr key={i}>
                      <td className="px-6 py-4" colSpan={8}>
                        <div className="h-4 w-full animate-pulse rounded bg-surface-container" />
                      </td>
                    </tr>
                  ))
                : leads.map((lead) => (
                    <tr
                      key={lead.id}
                      onClick={() => router.push(`/leads/${lead.id}`)}
                      className="cursor-pointer hover:bg-surface-container-low transition-colors"
                    >
                      <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={selectedIds.has(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded border-card-border" />
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-on-surface">{lead.property_address || 'No address'}</p>
                        <p className="text-xs text-secondary">{formatPhone(lead.phone)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-medium text-on-surface">{lead.owner_name || lead.name || '--'}</p>
                      </td>
                      <td className="px-6 py-4">
                        <Badge status={lead.status} />
                      </td>
                      <td className="px-6 py-4">
                        {lead.priority ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${PRIORITY_COLORS[lead.priority]}`}>
                            {lead.priority}
                          </span>
                        ) : <span className="text-xs text-on-surface-variant">--</span>}
                      </td>
                      <td className="px-6 py-4 text-secondary text-sm">{lead.source ?? '--'}</td>
                      <td className="px-6 py-4 text-sm text-secondary">
                        {lead.last_contact_date ? timeAgo(lead.last_contact_date) : 'Never'}
                      </td>
                      <td className="px-6 py-4 text-sm text-secondary">
                        {lead.follow_up_date ? formatDate(lead.follow_up_date) : '--'}
                      </td>
                    </tr>
                  ))}

              {!loading && leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto mb-4">
                      <MaterialIcon icon="person_search" className="text-[32px] text-on-surface-variant" />
                    </div>
                    <h3 className="text-lg font-bold text-on-surface">No leads found</h3>
                    <p className="text-on-surface-variant max-w-sm mx-auto mt-1 text-sm">Try adjusting your filters or import a new list.</p>
                    <a href="/imports" className="inline-flex items-center gap-2 mt-4 px-6 py-2 bg-primary text-white font-bold rounded-lg text-sm hover:bg-primary/90 transition-colors">
                      Import a List
                    </a>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 0 && (
          <div className="flex items-center justify-between border-t border-card-border bg-surface-container-low px-6 py-3">
            <span className="text-sm text-secondary">Showing {rangeStart}–{rangeEnd} of {totalCount}</span>
            <Pagination currentPage={currentPage} totalPages={totalPages} onPageChange={setCurrentPage} />
          </div>
        )}
      </div>

      <ExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        selectedIds={Array.from(selectedIds)}
        totalFiltered={totalCount}
        allFilteredIds={allFilteredIds}
      />
    </div>
  );
}
