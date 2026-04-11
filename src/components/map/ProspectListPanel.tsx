"use client";

import { useState } from "react";
import MaterialIcon from "@/components/ui/MaterialIcon";

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

const PRICE_PER_ADDRESS = 0.18;
const MIN_ORDER_SIZE = 10;

export default function ProspectListPanel({ addresses, onRemove, onClear, onClose, onOrderComplete }: Props) {
  const total = (addresses.length * PRICE_PER_ADDRESS).toFixed(2);
  const [ordering, setOrdering] = useState(false);
  const [orderResult, setOrderResult] = useState<{ success: boolean; message: string } | null>(null);

  async function handleOrder() {
    setOrdering(true);
    setOrderResult(null);

    try {
      const res = await fetch('/api/stripe/order-skip-traces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.require_subscription) {
          setOrderResult({ success: false, message: 'Subscribe to a plan to order skip traces.' });
        } else {
          setOrderResult({ success: false, message: data.error || 'Order failed' });
        }
        setOrdering(false);
        return;
      }

      // Immediate charge succeeded
      if (data.success) {
        setOrderResult({ success: true, message: `Order placed! $${data.charged.toFixed(2)} charged. We&apos;ll have your data ready shortly.` });
        setTimeout(() => {
          onOrderComplete?.();
          onClear();
          onClose();
        }, 3000);
        setOrdering(false);
        return;
      }

      // Redirect to Stripe checkout
      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      setOrderResult({ success: false, message: 'Unexpected response' });
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
            <button
              onClick={onClear}
              className="text-[10px] font-bold text-red-400 uppercase tracking-widest hover:underline"
            >
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
            <p className="text-xs text-on-surface-variant/60 mt-1">Use the Prospects tool on reference properties to build your list</p>
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

      {/* Footer: pricing + order CTA */}
      {addresses.length > 0 && (
        <div className="border-t border-card-border px-5 py-4 space-y-3 shrink-0">
          <div className="flex items-center justify-between text-sm">
            <span className="text-on-surface-variant">{addresses.length} addresses × ${PRICE_PER_ADDRESS.toFixed(2)}</span>
            <span className="font-bold text-on-surface">${total}</span>
          </div>
          <p className="text-[10px] text-on-surface-variant/60">
            We&apos;ll get owner names + phone numbers for each address.
          </p>

          {orderResult && (
            <div className={`rounded-lg p-3 text-xs font-semibold ${orderResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
              {orderResult.message}
            </div>
          )}

          {addresses.length < MIN_ORDER_SIZE && (
            <p className="text-[10px] text-on-surface-variant/60 text-center">
              Minimum order: {MIN_ORDER_SIZE} addresses ({MIN_ORDER_SIZE - addresses.length} more needed)
            </p>
          )}

          <button
            onClick={handleOrder}
            disabled={ordering || addresses.length < MIN_ORDER_SIZE}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {ordering ? (
              <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Processing...</>
            ) : (
              <><MaterialIcon icon="shopping_cart" className="text-[18px]" /> Order Skip Traces — ${total}</>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
