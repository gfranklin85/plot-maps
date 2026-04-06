'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';

const PLANS = [
  {
    name: 'Starter',
    price: 49,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || '',
    features: [
      'Interactive 3D Map View',
      'Walk Mode — Street View Prospecting',
      'Import your own property lists',
      'MLS data overlay (Sold/Active/Pending)',
      'Call scripts & notes',
      'AI follow-up suggestions',
      'Manual dialing (use your phone)',
      '500 geocodes/month',
      '1,000 street view loads/month',
      '$0.01/geocode overage available',
    ],
    highlighted: false,
  },
  {
    name: 'Pro',
    price: 79,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRO_PRICE_ID || '',
    features: [
      'Everything in Starter, plus:',
      'Browser Dialer — click to call from the app',
      'Local phone number included',
      'Call recording',
      'Full call analytics dashboard',
      '1,000 calling minutes/month',
      '2,000 geocodes/month',
      'Unlimited street view loads',
      'Priority support',
    ],
    highlighted: true,
  },
];

export default function SubscribePage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [showCancelBanner, setShowCancelBanner] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('checkout') === 'canceled') {
      setShowCancelBanner(true);
    }
  }, []);

  async function handleSubscribe(priceId: string) {
    if (!priceId) {
      alert('Pricing not configured yet. Contact support.');
      return;
    }
    setLoading(priceId);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const { url, error } = await res.json();
      if (error) throw new Error(error);
      if (url) window.location.href = url;
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center p-8">
      <div className="max-w-4xl w-full">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold text-slate-900 font-headline tracking-tight">
            Plot Maps
          </h1>
          <p className="text-lg text-slate-500 mt-2">
            Visual Prospecting CRM — Upgrade for more geocodes and features
          </p>
          <p className="text-sm text-slate-400 mt-1">
            You have 50 free geocodes to try the platform. Subscribe for more.
          </p>
        </div>

        {showCancelBanner && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <p className="text-sm text-amber-800">
              Checkout was canceled. No worries — upgrade whenever you&apos;re ready.
            </p>
            <button
              onClick={() => setShowCancelBanner(false)}
              className="text-amber-600 hover:text-amber-800 ml-4"
            >
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 ${
                plan.highlighted
                  ? 'bg-white border-2 border-blue-500 shadow-xl shadow-blue-500/10 relative'
                  : 'bg-white border border-slate-200 shadow-lg'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
              )}

              <h2 className="text-2xl font-bold text-slate-900">{plan.name}</h2>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-extrabold text-slate-900">${plan.price}</span>
                <span className="text-slate-500 text-sm">/month</span>
              </div>

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <MaterialIcon
                      icon={i === 0 && plan.highlighted ? 'star' : 'check_circle'}
                      className={`text-[16px] mt-0.5 shrink-0 ${
                        plan.highlighted ? 'text-blue-500' : 'text-emerald-500'
                      }`}
                    />
                    <span className={`${i === 0 && plan.highlighted ? 'font-bold text-slate-900' : 'text-slate-600'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={!!loading}
                className={`w-full mt-8 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${
                  plan.highlighted
                    ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {loading === plan.priceId ? 'Redirecting...' : `Subscribe — $${plan.price}/mo`}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-xs text-slate-400 mt-8">
          Cancel anytime. No long-term contracts. Questions? Email support@plotmaps.com
        </p>
      </div>
    </div>
  );
}
