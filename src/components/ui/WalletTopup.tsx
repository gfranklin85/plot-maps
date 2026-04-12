"use client";

import { useState } from "react";
import MaterialIcon from "./MaterialIcon";

interface Props {
  onClose: () => void;
  currentBalance?: string;
}

const QUICK_AMOUNTS = [
  { cents: 1000, label: "$10", properties: "40 properties" },
  { cents: 2500, label: "$25", properties: "100 properties" },
  { cents: 5000, label: "$50", properties: "200 properties" },
];

export default function WalletTopup({ onClose, currentBalance }: Props) {
  const [selectedCents, setSelectedCents] = useState(1000);
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const amountCents = useCustom
    ? Math.round(parseFloat(customAmount || "0") * 100)
    : selectedCents;

  const isValid = amountCents >= 1000;

  async function handleTopup() {
    if (!isValid) return;
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/wallet/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: amountCents }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Top-up failed");
        setLoading(false);
        return;
      }

      if (data.success) {
        // Immediate charge succeeded — close and refresh
        onClose();
        window.location.reload();
        return;
      }

      if (data.checkout_url) {
        window.location.href = data.checkout_url;
        return;
      }

      setError("Unexpected response");
    } catch {
      setError("Network error");
    }
    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-card rounded-2xl border border-card-border shadow-2xl overflow-hidden">
        <div className="p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-headline text-lg font-bold text-on-surface">Add Funds</h2>
            <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
              <MaterialIcon icon="close" className="text-[20px]" />
            </button>
          </div>

          {currentBalance && (
            <div className="text-center py-2">
              <p className="text-xs text-on-surface-variant uppercase tracking-wider">Current Balance</p>
              <p className="text-2xl font-bold text-emerald-400">${currentBalance}</p>
            </div>
          )}

          {/* Quick amounts */}
          <div className="grid grid-cols-3 gap-2">
            {QUICK_AMOUNTS.map(({ cents, label, properties }) => (
              <button
                key={cents}
                onClick={() => { setSelectedCents(cents); setUseCustom(false); }}
                className={`p-3 rounded-xl text-center transition-all ${
                  !useCustom && selectedCents === cents
                    ? "bg-primary text-white border-2 border-primary"
                    : "bg-surface-container-high border-2 border-transparent text-on-surface hover:border-primary/30"
                }`}
              >
                <p className="text-lg font-bold">{label}</p>
                <p className="text-[9px] text-on-surface-variant mt-0.5">{properties}</p>
              </button>
            ))}
          </div>

          {/* Custom amount */}
          <div>
            <button
              onClick={() => setUseCustom(true)}
              className={`text-xs font-bold uppercase tracking-wider ${useCustom ? 'text-primary' : 'text-on-surface-variant hover:text-primary'} transition-colors`}
            >
              Custom amount
            </button>
            {useCustom && (
              <div className="mt-2 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">$</span>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  min="10"
                  step="1"
                  placeholder="10.00"
                  autoFocus
                  className="w-full pl-8 pr-4 py-3 rounded-xl bg-surface-container-low border border-card-border text-on-surface font-bold text-lg focus:ring-2 focus:ring-primary/30 outline-none"
                />
                {amountCents > 0 && amountCents < 1000 && (
                  <p className="text-[10px] text-red-400 mt-1">Minimum $10.00</p>
                )}
              </div>
            )}
          </div>

          <p className="text-[10px] text-on-surface-variant/60 text-center">
            $0.25 per property · {Math.floor(amountCents / 25)} properties with ${(amountCents / 100).toFixed(2)}
          </p>

          {error && (
            <div className="rounded-lg bg-red-500/10 p-3 text-xs font-semibold text-red-400">{error}</div>
          )}

          <button
            onClick={handleTopup}
            disabled={loading || !isValid}
            className="w-full py-3.5 rounded-xl bg-gradient-to-br from-primary/80 to-primary text-white font-bold text-sm flex items-center justify-center gap-2 shadow-[0_8px_25px_-5px_hsl(var(--primary)/0.4)] hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {loading ? (
              <><span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Processing...</>
            ) : (
              <><MaterialIcon icon="add" className="text-[18px]" /> Add ${(amountCents / 100).toFixed(2)} to Wallet</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
