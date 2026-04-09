'use client';

import { useState, useEffect } from 'react';
import MaterialIcon from '@/components/ui/MaterialIcon';
import { supabase } from '@/lib/supabase';

const PLANS = [
  {
    name: 'Starter',
    price: 49,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTER_PRICE_ID || '',
    features: [
      'Walk Mode — Street View Prospecting',
      'AI-powered action lists & call guidance',
      'AI email drafts & outreach',
      'Nearby places & drive time analysis',
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
      'Call recording & analytics',
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/signup?next=/subscribe';
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
    <div className="min-h-screen bg-surface relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(79,70,229,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px]" />

      <main className="relative z-10 max-w-5xl mx-auto px-6 py-20">
        {/* Hero */}
        <section className="text-center mb-16">
          <h1 className="text-5xl md:text-6xl font-extrabold tracking-tight text-white mb-6 font-headline">
            Free to Map. <span className="text-primary italic">Paid to Move.</span>
          </h1>
          <p className="text-secondary text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
            Visualize your properties for free. Unlock Walk Mode, AI tools, and advanced analytics when you&apos;re ready to close deals.
          </p>
        </section>

        {showCancelBanner && (
          <div className="mb-8 bg-amber-900/20 border border-amber-500/30 rounded-xl p-4 flex items-center justify-between max-w-2xl mx-auto">
            <p className="text-sm text-amber-200">
              Checkout was canceled. No worries — upgrade whenever you&apos;re ready.
            </p>
            <button onClick={() => setShowCancelBanner(false)} className="text-amber-400 hover:text-amber-200 ml-4">
              <MaterialIcon icon="close" className="text-[18px]" />
            </button>
          </div>
        )}

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-2 gap-8 mb-16">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-8 flex flex-col ${
                plan.highlighted
                  ? 'bg-surface-container-high border-2 border-indigo-500/40 shadow-2xl shadow-indigo-900/20 relative'
                  : 'bg-card border border-card-border'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-[10px] font-black uppercase tracking-widest px-4 py-1 rounded-full">
                  Recommended
                </div>
              )}

              <h3 className={`text-xs font-black uppercase tracking-widest mb-2 ${plan.highlighted ? 'text-primary' : 'text-secondary'}`}>
                {plan.name}
              </h3>
              <div className="flex items-baseline gap-1 mb-8">
                <span className="text-4xl font-extrabold text-white">${plan.price}</span>
                <span className="text-secondary">/mo</span>
              </div>

              <ul className="space-y-4 mb-10 flex-grow">
                {plan.features.map((feature, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm">
                    <MaterialIcon
                      icon="check_circle"
                      className={`text-[16px] shrink-0 ${plan.highlighted ? 'text-primary' : 'text-primary/60'}`}
                    />
                    <span className={`${i === 0 && plan.highlighted ? 'font-bold text-white' : 'text-on-surface-variant'}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSubscribe(plan.priceId)}
                disabled={!!loading}
                className={`w-full py-4 rounded-xl font-bold text-sm transition-all disabled:opacity-50 ${
                  plan.highlighted
                    ? 'bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:opacity-90 active:scale-[0.98]'
                    : 'bg-surface-container-high text-on-surface hover:bg-surface-container-highest border border-card-border'
                }`}
              >
                {loading === plan.priceId ? 'Redirecting...' : `Choose ${plan.name}`}
              </button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-secondary">
          Cancel anytime. No long-term contracts.
        </p>
      </main>
    </div>
  );
}
