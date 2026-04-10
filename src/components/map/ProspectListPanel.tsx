"use client";

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
}

const PRICE_PER_ADDRESS = 0.18;

export default function ProspectListPanel({ addresses, onRemove, onClear, onClose }: Props) {
  const total = (addresses.length * PRICE_PER_ADDRESS).toFixed(2);

  return (
    <div className="fixed right-0 top-0 h-full w-[400px] z-50 bg-card border-l border-card-border shadow-2xl flex flex-col">
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
            We'll get owner names + phone numbers for each address.
          </p>
          <button
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <MaterialIcon icon="shopping_cart" className="text-[18px]" />
            Order Skip Traces — ${total}
          </button>
        </div>
      )}
    </div>
  );
}
