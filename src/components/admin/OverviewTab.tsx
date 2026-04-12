'use client';

import { useState, useEffect, useCallback } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { SummaryCard, timeAgo, type Summary, type UserRow, type HotProspect } from './admin-utils';
import PeopleTable from './PeopleTable';

interface ProspectOrder {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  status: string;
  address_count: number;
  amount_cents: number;
  addresses: { address: string; lat: number; lng: number }[];
  created_at: string;
  completed_at: string | null;
}

interface CostData {
  todayBurn: number;
  monthBurn: number;
  byService: { service: string; cost: number }[];
}

interface Props {
  summary: Summary;
  users: UserRow[];
  hotProspects: HotProspect[];
  liveVisitors: number;
  costs?: CostData | null;
}

export default function OverviewTab({ summary, users, hotProspects, liveVisitors, costs }: Props) {
  // ── Skip trace orders state ──
  const [orders, setOrders] = useState<ProspectOrder[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<ProspectOrder | null>(null);
  const [orderUpdating, setOrderUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  async function updateOrder(orderId: string, status: string) {
    setOrderUpdating(true);
    try {
      await fetch('/api/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, status }),
      });
      await fetchOrders();
      setSelectedOrder(null);
    } catch { /* silent */ }
    setOrderUpdating(false);
  }

  function exportOrderCSV(order: ProspectOrder) {
    const rows = ['Address,Lat,Lng'];
    for (const a of order.addresses) {
      rows.push(`"${a.address}",${a.lat},${a.lng}`);
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `order-${order.id.slice(0, 8)}-${order.address_count}addresses.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-8">
      {/* Hero Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="col-span-2">
          <SummaryCard
            label="Est. MRR"
            value={`$${summary.estimatedMRR.toLocaleString()}`}
            sub={`${summary.activeSubscribers} active subscriber${summary.activeSubscribers !== 1 ? 's' : ''}`}
            icon="payments"
            accent
            large
          />
        </div>
        <SummaryCard
          label="Subscribers"
          value={summary.activeSubscribers}
          sub={`of ${summary.totalUsers} total users`}
          icon="group"
        />
        <SummaryCard
          label="Seeded Records"
          value={summary.totalContext.toLocaleString()}
          sub={`${summary.totalTargets.toLocaleString()} targets`}
          icon="layers"
        />
        <div className="relative">
          <SummaryCard
            label="Live Visitors"
            value={liveVisitors}
            sub="browsing now"
            icon="radio_button_checked"
          />
          {liveVisitors > 0 && (
            <span className="absolute top-4 right-4 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
            </span>
          )}
        </div>
      </div>

      {/* Platform Costs */}
      {costs && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <SummaryCard label="Burn Today" value={`$${costs.todayBurn.toFixed(2)}`} sub="platform API costs" icon="local_fire_department" alert={costs.todayBurn > 5} />
          <SummaryCard label="Burn This Month" value={`$${costs.monthBurn.toFixed(2)}`} sub={`$${summary.activeSubscribers > 0 ? (costs.monthBurn / summary.activeSubscribers).toFixed(2) : '0.00'}/subscriber`} icon="trending_up" />
          {costs.byService.slice(0, 2).map(s => (
            <SummaryCard key={s.service} label={s.service.replace('_', ' ')} value={`$${s.cost.toFixed(2)}`} sub="this month" icon="receipt_long" />
          ))}
        </div>
      )}

      {/* People Table */}
      <PeopleTable users={users} hotProspects={hotProspects} />

      {/* ═══ SKIP TRACE ORDERS ═══ */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-on-surface font-headline tracking-tight">
            <MaterialIcon icon="shopping_cart" className="text-[18px] text-primary mr-2" />
            Skip Trace Orders
            {orders.filter(o => o.status === 'paid').length > 0 && (
              <span className="ml-2 text-sm font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                {orders.filter(o => o.status === 'paid').length} to fulfill
              </span>
            )}
          </h2>
          <button onClick={fetchOrders} className="text-secondary hover:text-on-surface transition-colors">
            <MaterialIcon icon="refresh" className="text-[18px]" />
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-card border border-card-border rounded-xl p-8 text-center">
            <MaterialIcon icon="inbox" className="text-[32px] text-secondary mb-2" />
            <p className="text-sm text-secondary">No orders yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Orders Table */}
            <div className="lg:col-span-7 bg-card border border-card-border rounded-xl overflow-hidden">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-[10px] uppercase tracking-widest text-secondary border-b border-card-border">
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Addresses</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-card-border/50">
                  {orders.map(order => (
                    <tr
                      key={order.id}
                      onClick={() => setSelectedOrder(order)}
                      className={`cursor-pointer hover:bg-surface-container-high/50 transition-colors ${selectedOrder?.id === order.id ? 'bg-primary/5' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-on-surface text-sm">{order.user_name}</div>
                        <div className="text-[10px] text-secondary">{order.user_email}</div>
                      </td>
                      <td className="px-4 py-3 text-sm font-bold text-on-surface">{order.address_count}</td>
                      <td className="px-4 py-3 text-sm text-on-surface">${(order.amount_cents / 100).toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider">
                          {order.status === 'paid' && <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />}
                          {order.status === 'completed' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                          {order.status === 'pending' && <span className="w-2 h-2 rounded-full bg-yellow-400" />}
                          <span className={
                            order.status === 'paid' ? 'text-orange-400' :
                            order.status === 'completed' ? 'text-emerald-400' :
                            'text-secondary'
                          }>{order.status}</span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-secondary">{timeAgo(order.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Order Detail Panel */}
            <div className="lg:col-span-5">
              {selectedOrder ? (
                <div className="bg-card border border-card-border rounded-xl p-5 space-y-4 sticky top-24">
                  <div className="flex items-center justify-between">
                    <h3 className="font-headline font-bold text-on-surface">Order Detail</h3>
                    <span className="text-[10px] font-mono text-secondary">{selectedOrder.id.slice(0, 8)}</span>
                  </div>

                  <div className="bg-surface-container-lowest p-3 rounded-lg border border-card-border space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary">User</p>
                    <p className="text-sm font-semibold text-on-surface">{selectedOrder.user_name}</p>
                    <p className="text-[10px] text-secondary">{selectedOrder.user_email}</p>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1 bg-surface-container-lowest p-3 rounded-lg border border-card-border text-center">
                      <p className="text-lg font-bold text-on-surface">{selectedOrder.address_count}</p>
                      <p className="text-[9px] text-secondary uppercase tracking-wider">Addresses</p>
                    </div>
                    <div className="flex-1 bg-surface-container-lowest p-3 rounded-lg border border-card-border text-center">
                      <p className="text-lg font-bold text-on-surface">${(selectedOrder.amount_cents / 100).toFixed(2)}</p>
                      <p className="text-[9px] text-secondary uppercase tracking-wider">Paid</p>
                    </div>
                  </div>

                  {/* Address list */}
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-secondary mb-2">Addresses</p>
                    <div className="max-h-48 overflow-y-auto space-y-1">
                      {selectedOrder.addresses.map((a, i) => (
                        <p key={i} className="text-xs text-on-surface">{a.address.split(',')[0]}</p>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <button
                    onClick={() => exportOrderCSV(selectedOrder)}
                    className="w-full py-2.5 rounded-lg bg-surface-container-high text-on-surface text-xs font-bold hover:bg-surface-container-highest transition-colors flex items-center justify-center gap-2"
                  >
                    <MaterialIcon icon="download" className="text-[16px]" />
                    Export CSV for PropWire
                  </button>

                  {selectedOrder.status !== 'completed' && (
                    <button
                      onClick={() => updateOrder(selectedOrder.id, 'completed')}
                      disabled={orderUpdating}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition-all"
                    >
                      <MaterialIcon icon="task_alt" className="text-[18px]" />
                      Mark as Fulfilled
                    </button>
                  )}

                  {selectedOrder.status === 'completed' && (
                    <div className="flex items-center justify-center gap-2 py-2 text-emerald-400">
                      <MaterialIcon icon="check_circle" className="text-[18px]" />
                      <span className="text-xs font-bold">Fulfilled</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-card border border-card-border rounded-xl p-8 text-center">
                  <MaterialIcon icon="touch_app" className="text-[28px] text-secondary mb-2" />
                  <p className="text-sm text-secondary">Select an order to view details</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
