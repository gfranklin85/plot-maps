"use client";

import { useState, useEffect, useCallback } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";
import WalletTopup from "@/components/ui/WalletTopup";

interface Address {
  address: string;
  lat: number;
  lng: number;
  city: string | null;
  state: string | null;
  zip: string | null;
}

interface Props {
  addresses: Address[];
  onRemove: (address: string) => void;
  onClear: () => void;
  onClose: () => void;
  onOrderComplete?: () => void;
}

interface UsageInfo {
  skip_traces_remaining: number;
  skip_traces_limit: number;
  tier: string;
  tier_label: string;
  overage_cost_cents: number;
  wallet_balance_cents: number;
}

export default function ProspectListPanel({ addresses, onRemove, onClear, onClose, onOrderComplete }: Props) {
  const [usage, setUsage] = useState<UsageInfo | null>(null);
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showTopup, setShowTopup] = useState(false);

  const fetchUsage = useCallback(async () => {
    try {
      const [usageRes, walletRes] = await Promise.all([
        fetch('/api/usage').then(r => r.json()),
        fetch('/api/wallet').then(r => r.json()).catch(() => ({ balance_cents: 0 })),
      ]);
      setUsage({
        skip_traces_remaining: usageRes.skip_traces_remaining ?? 0,
        skip_traces_limit: usageRes.skip_traces_limit ?? 0,
        tier: usageRes.tier || 'free',
        tier_label: usageRes.tier_label || 'Free',
        overage_cost_cents: usageRes.overage_cost_cents ?? 0,
        wallet_balance_cents: walletRes.balance_cents ?? 0,
      });
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchUsage();
  }, [fetchUsage]);

  // Calculate breakdown
  const needed = addresses.length;
  const includedRemaining = usage?.skip_traces_remaining ?? 0;
  const fromCredits = Math.min(needed, includedRemaining);
  const fromOverage = Math.max(0, needed - fromCredits);
  const overageRate = usage?.overage_cost_cents ?? 0;
  const overageCostCents = fromOverage * overageRate;
  const walletBalanceCents = usage?.wallet_balance_cents ?? 0;
  const isFree = usage?.tier === 'free';
  const hasOverageSupport = !isFree && overageRate > 0;

  const sufficientWallet = walletBalanceCents >= overageCostCents;
  const canOrder =
    needed > 0 &&
    (fromOverage === 0 || (hasOverageSupport && sufficientWallet));

  async function handleConfirm() {
    setOrdering(true);
    setOrderResult(null);

    try {
      const res = await fetch('/api/skip-trace/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses }),
      });

      const data = await res.json();

      if (!res.ok) {
        setOrderResult({ success: false, message: data.message || data.error || 'Order failed' });
        // Refresh usage in case server state changed
        fetchUsage();
        setOrdering(false);
        return;
      }

      // Refresh usage
      fetchUsage();

      const successMsg =
        data.from_overage > 0
          ? `Done! ${data.from_credits} from credits + ${data.from_overage} overage ($${(data.overage_cost_cents / 100).toFixed(2)}) submitted.`
          : `Done! ${needed} addresses submitted for skip tracing.`;
      setOrderResult({ success: true, message: successMsg });

      setTimeout(() => {
        onOrderComplete?.();
        onClear();
        onClose();
      }, 2500);
    } catch {
      setOrderResult({ success: false, message: 'Network error. Please try again.' });
    }

    setOrdering(false);
  }

  return (
    <div className="fixed right-0 top-0 h-full w-full md:w-[400px] z-50 bg-card border-l border-card-border shadow-2xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-card-border shrink-0">
        <div>
          <h2 className="font-headline text-lg font-extrabold text-on-surface">Prospect List</h2>
          <p className="text-xs text-on-surface-variant mt-0.5">{addresses.length} addresses selected</p>
        </div>
        <div className="flex items-center gap-2">
          {addresses.length > 0 && (
            <button onClick={onClear} className="text-[10px] font-bold text-red-400 uppercase tracking-widest hover:underline">
              Clear All
            </button>
          )}
          <button onClick={onClose} className="text-secondary hover:text-on-surface transition-colors">
            <MaterialIcon icon="close" className="text-[20px]" />
          </button>
        </div>
      </div>

      {/* Address list */}
      <div className="flex-1 overflow-y-auto">
        {addresses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <MaterialIcon icon="location_searching" className="text-[40px] text-on-surface-variant/30 mb-3" />
            <p className="text-sm text-on-surface-variant">No addresses selected yet</p>
            <p className="text-xs text-on-surface-variant/60 mt-1">Click houses on the map to build your list</p>
          </div>
        ) : (
          <div className="divide-y divide-card-border/50">
            {addresses.map((addr, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3 hover:bg-surface-container-high/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-on-surface truncate">{addr.address.split(',')[0]}</p>
                  <p className="text-[11px] text-on-surface-variant">
                    {[addr.city, addr.state, addr.zip].filter(Boolean).join(', ')}
                  </p>
                </div>
                <button
                  onClick={() => onRemove(addr.address)}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 transition-all shrink-0 ml-2"
                >
                  <MaterialIcon icon="close" className="text-[16px]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer: breakdown + confirm */}
      {addresses.length > 0 && (
        <div className="border-t border-card-border px-5 py-4 space-y-3 shrink-0">
          {/* Breakdown */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-on-surface-variant">This order</span>
              <span className="font-bold text-on-surface">{needed} traces</span>
            </div>

            {fromCredits > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-on-surface-variant">From included credits</span>
                <span className="font-semibold text-emerald-400">{fromCredits}</span>
              </div>
            )}

            {fromOverage > 0 && hasOverageSupport && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">
                    Overage ({fromOverage} @ ${(overageRate / 100).toFixed(2)})
                  </span>
                  <span className="font-semibold text-orange-400">
                    ${(overageCostCents / 100).toFixed(2)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">Wallet balance</span>
                  <span className={`font-semibold ${sufficientWallet ? 'text-emerald-400' : 'text-red-400'}`}>
                    ${(walletBalanceCents / 100).toFixed(2)}
                  </span>
                </div>
              </>
            )}

            {usage && (
              <div className="flex items-center justify-between text-[10px] pt-1 border-t border-card-border/50">
                <span className="text-on-surface-variant/60">{usage.tier_label} plan</span>
                <span className="text-on-surface-variant/60">{includedRemaining} of {usage.skip_traces_limit} left</span>
              </div>
            )}
          </div>

          {orderResult && (
            <div className={`rounded-lg p-3 text-xs font-semibold ${orderResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {orderResult.message}
            </div>
          )}

          {/* CTA — depends on state */}
          {canOrder ? (
            <button
              onClick={handleConfirm}
              disabled={ordering}
              className="w-full py-3.5 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
            >
              {ordering ? (
                <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Processing...</>
              ) : (
                <>
                  <MaterialIcon icon="person_search" className="text-[18px]" />
                  {fromOverage > 0 ? `Skip Trace — $${(overageCostCents / 100).toFixed(2)} overage` : `Skip Trace ${needed} Addresses`}
                </>
              )}
            </button>
          ) : fromOverage > 0 && hasOverageSupport && !sufficientWallet ? (
            <div className="space-y-2">
              <p className="text-[11px] text-orange-400 text-center">
                You need ${((overageCostCents - walletBalanceCents) / 100).toFixed(2)} more in your wallet.
              </p>
              <button
                onClick={() => setShowTopup(true)}
                className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <MaterialIcon icon="add" className="text-[18px]" />
                Add Funds for Overage
              </button>
            </div>
          ) : isFree && fromOverage > 0 ? (
            <div className="space-y-2">
              <p className="text-[11px] text-orange-400 text-center">
                You&apos;ve used all {usage?.skip_traces_limit} free skip traces.
              </p>
              <a
                href="/subscribe"
                className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <MaterialIcon icon="upgrade" className="text-[18px]" />
                Subscribe to Skip Trace More
              </a>
            </div>
          ) : null}

          <p className="text-[10px] text-on-surface-variant/50 text-center">
            We&apos;ll get owner names + phone numbers for each address.
          </p>
        </div>
      )}

      {showTopup && (
        <WalletTopup
          onClose={() => {
            setShowTopup(false);
            fetchUsage();
          }}
          currentBalance={(walletBalanceCents / 100).toFixed(2)}
        />
      )}
    </div>
  );
}
