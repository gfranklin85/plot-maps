'use client';

import { useState, useEffect, useCallback } from 'react';
import { MarketComp, CompType } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface Props {
  leadId: string;
}

const COMP_TYPE_COLORS: Record<CompType, string> = {
  sold: 'bg-emerald-100 text-emerald-700',
  active: 'bg-blue-100 text-blue-700',
  pending: 'bg-amber-100 text-amber-700',
};

const EMPTY_FORM = {
  address: '',
  sale_price: '',
  list_price: '',
  sqft: '',
  beds: '',
  baths: '',
  comp_type: 'sold' as CompType,
  dom: '',
  notes: '',
};

export default function MarketComps({ leadId }: Props) {
  const [comps, setComps] = useState<MarketComp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchComps = useCallback(async () => {
    const { data, error: fetchError } = await supabase
      .from('market_comps')
      .select('*')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false });

    if (fetchError) {
      setError(fetchError.message);
    } else {
      setComps(data || []);
    }
    setLoading(false);
  }, [leadId]);

  useEffect(() => {
    fetchComps();
  }, [fetchComps]);

  async function handleSaveComp() {
    if (!form.address.trim()) return;

    setSaving(true);
    setError(null);
    try {
      const insert: Record<string, unknown> = {
        lead_id: leadId,
        address: form.address.trim(),
        comp_type: form.comp_type,
      };
      if (form.sale_price) insert.sale_price = parseFloat(form.sale_price);
      if (form.list_price) insert.list_price = parseFloat(form.list_price);
      if (form.sqft) insert.sqft = parseInt(form.sqft);
      if (form.beds) insert.beds = parseInt(form.beds);
      if (form.baths) insert.baths = parseFloat(form.baths);
      if (form.dom) insert.dom = parseInt(form.dom);
      if (form.notes.trim()) insert.notes = form.notes.trim();

      // Calculate price_per_sqft
      const price = insert.sale_price || insert.list_price;
      if (price && insert.sqft) {
        insert.price_per_sqft = Math.round((price as number) / (insert.sqft as number));
      }

      const { error: insertError } = await supabase.from('market_comps').insert(insert);
      if (insertError) throw insertError;

      setForm(EMPTY_FORM);
      setShowForm(false);
      await fetchComps();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save comp');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this comp?')) return;

    setDeleting(id);
    setError(null);
    try {
      const { error: deleteError } = await supabase.from('market_comps').delete().eq('id', id);
      if (deleteError) throw deleteError;
      setComps((prev) => prev.filter((c) => c.id !== id));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to delete comp');
    } finally {
      setDeleting(null);
    }
  }

  // Summary stats
  const soldComps = comps.filter((c) => c.comp_type === 'sold');
  const activeComps = comps.filter((c) => c.comp_type === 'active');
  const pendingComps = comps.filter((c) => c.comp_type === 'pending');

  const allPricePerSqft = comps
    .map((c) => c.price_per_sqft)
    .filter((v): v is number => v !== null && v > 0);
  const avgPricePerSqft =
    allPricePerSqft.length > 0
      ? Math.round(allPricePerSqft.reduce((a, b) => a + b, 0) / allPricePerSqft.length)
      : null;

  return (
    <div className="rounded-2xl bg-surface-container-lowest p-5 border border-card-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100">
            <MaterialIcon icon="real_estate_agent" className="text-[20px] text-emerald-600" filled />
          </div>
          <h3 className="font-headline text-lg font-bold text-on-surface">Market Comps</h3>
        </div>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-on-primary shadow-sm hover:shadow-md transition-all"
        >
          <MaterialIcon icon={showForm ? 'close' : 'add'} className="text-[16px]" />
          {showForm ? 'Cancel' : 'Add Comp'}
        </button>
      </div>

      {/* Summary */}
      {comps.length > 0 && (
        <div className="mb-4 rounded-xl bg-surface-container-low px-4 py-2.5 text-xs text-secondary font-medium">
          {soldComps.length} sold{activeComps.length > 0 ? `, ${activeComps.length} active` : ''}
          {pendingComps.length > 0 ? `, ${pendingComps.length} pending` : ''} nearby
          {avgPricePerSqft && ` \u2022 Avg $${avgPricePerSqft}/sqft`}
        </div>
      )}

      {/* Inline Add Form */}
      {showForm && (
        <div className="mb-4 rounded-xl border border-outline-variant bg-surface-container-low p-4 space-y-3">
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="Address *"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <div className="grid grid-cols-3 gap-2">
            <input
              type="number"
              value={form.sale_price}
              onChange={(e) => setForm({ ...form, sale_price: e.target.value })}
              placeholder="Sale Price"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              value={form.list_price}
              onChange={(e) => setForm({ ...form, list_price: e.target.value })}
              placeholder="List Price"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              value={form.sqft}
              onChange={(e) => setForm({ ...form, sqft: e.target.value })}
              placeholder="Sqft"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="grid grid-cols-4 gap-2">
            <input
              type="number"
              value={form.beds}
              onChange={(e) => setForm({ ...form, beds: e.target.value })}
              placeholder="Beds"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              value={form.baths}
              onChange={(e) => setForm({ ...form, baths: e.target.value })}
              placeholder="Baths"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <input
              type="number"
              value={form.dom}
              onChange={(e) => setForm({ ...form, dom: e.target.value })}
              placeholder="DOM"
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={form.comp_type}
              onChange={(e) => setForm({ ...form, comp_type: e.target.value as CompType })}
              className="rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="sold">Sold</option>
              <option value="active">Active</option>
              <option value="pending">Pending</option>
            </select>
          </div>

          <input
            type="text"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            placeholder="Notes (optional)"
            className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          <button
            onClick={handleSaveComp}
            disabled={!form.address.trim() || saving}
            className={cn(
              'flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all',
              form.address.trim() && !saving
                ? 'bg-primary text-on-primary shadow-sm hover:shadow-md'
                : 'bg-surface-container text-on-surface-variant cursor-not-allowed'
            )}
          >
            {saving ? (
              <>
                <MaterialIcon icon="progress_activity" className="text-[16px] animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <MaterialIcon icon="save" className="text-[16px]" />
                Save Comp
              </>
            )}
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-secondary">
          <MaterialIcon icon="progress_activity" className="text-[24px] animate-spin" />
        </div>
      ) : comps.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-secondary">
          <MaterialIcon icon="real_estate_agent" className="text-[40px] text-on-surface-variant" />
          <p className="mt-2 text-sm">No comps added yet</p>
        </div>
      ) : (
        /* Comp table */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-outline-variant text-xs font-semibold uppercase tracking-wide text-secondary">
                <th className="pb-2 pr-3">Address</th>
                <th className="pb-2 pr-3">Price</th>
                <th className="pb-2 pr-3">Sqft</th>
                <th className="pb-2 pr-3">Type</th>
                <th className="pb-2 pr-3">DOM</th>
                <th className="pb-2 w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {comps.map((comp) => (
                <tr key={comp.id} className="group hover:bg-surface-container-low transition-colors">
                  <td className="py-2.5 pr-3 font-medium text-on-surface max-w-[200px] truncate">
                    {comp.address}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {comp.sale_price
                      ? formatCurrency(comp.sale_price)
                      : comp.list_price
                      ? formatCurrency(comp.list_price)
                      : '\u2014'}
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {comp.sqft ? `${comp.sqft.toLocaleString()} sqft` : '\u2014'}
                  </td>
                  <td className="py-2.5 pr-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
                        COMP_TYPE_COLORS[comp.comp_type]
                      )}
                    >
                      {comp.comp_type}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    {comp.dom !== null ? `${comp.dom}d` : '\u2014'}
                  </td>
                  <td className="py-2.5">
                    <button
                      onClick={() => handleDelete(comp.id)}
                      disabled={deleting === comp.id}
                      className="opacity-0 group-hover:opacity-100 flex items-center justify-center h-7 w-7 rounded-lg text-rose-500 hover:bg-rose-50 transition-all"
                    >
                      {deleting === comp.id ? (
                        <MaterialIcon icon="progress_activity" className="text-[14px] animate-spin" />
                      ) : (
                        <MaterialIcon icon="delete" className="text-[16px]" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-2 text-sm text-rose-700">
          <MaterialIcon icon="error" className="text-[16px]" />
          {error}
        </div>
      )}
    </div>
  );
}
