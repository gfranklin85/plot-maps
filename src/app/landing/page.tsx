'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [featureTab, setFeatureTab] = useState<'map' | 'walk' | 'intel'>('map');

  return (
    <div className="bg-[#0c1324] text-[#dce1fb] min-h-screen font-body selection:bg-indigo-500/30 scroll-smooth">
      {/* Top Navigation */}
      <header className="fixed top-0 w-full z-50 bg-[#0c1324]/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <nav className="flex justify-between items-center px-5 sm:px-8 py-3 sm:py-4 max-w-screen-2xl mx-auto">
          <Link href="/" className="text-xl sm:text-2xl font-black tracking-tighter text-indigo-100 font-headline">Plot Maps</Link>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-indigo-400 font-semibold border-b-2 border-indigo-500 pb-1 font-headline">Features</a>
            <a href="#pricing" className="text-slate-400 font-medium hover:text-indigo-200 transition-colors font-headline">Pricing</a>
            <a href="#use-cases" className="text-slate-400 font-medium hover:text-indigo-200 transition-colors font-headline">Use Cases</a>
            <Link className="text-slate-400 font-medium hover:text-indigo-200 transition-colors font-headline" href="/login">Sign In</Link>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold font-headline text-sm sm:text-base scale-95 hover:scale-100 transition-all duration-300">
              Try the Map
            </Link>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden p-2 text-slate-400 hover:text-white transition-colors">
              <span className="material-symbols-outlined text-[24px]">{mobileMenuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </nav>
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#151b2d] border-t border-slate-700/20 px-5 py-4 space-y-1">
            <a href="#features" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-indigo-400 font-semibold font-headline">Features</a>
            <a href="#pricing" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-400 font-headline">Pricing</a>
            <a href="#use-cases" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-400 font-headline">Use Cases</a>
            <Link href="/login" onClick={() => setMobileMenuOpen(false)} className="block py-3 text-slate-400 font-headline">Sign In</Link>
          </div>
        )}
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-24 sm:pt-40 pb-16 sm:pb-32 overflow-hidden">
          {/* Subtle glow */}
          <div className="absolute inset-0 -z-10" style={{ background: 'radial-gradient(circle at center, rgba(79,70,229,0.08) 0%, transparent 70%)' }} />

          <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="relative z-10">
              {/* Hero badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#23293c] border border-slate-700/20 mb-6">
                <span className="material-symbols-outlined text-indigo-400 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>my_location</span>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">Circle Prospecting, Reimagined</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-headline font-extrabold tracking-tight leading-[1.1] mb-4 sm:mb-8">
                See the listing.<br /><span className="text-indigo-400">Call the neighbors.</span>
              </h1>
              <p className="text-base sm:text-xl text-slate-400 leading-relaxed mb-6 sm:mb-8 max-w-xl">
                Active, Pending, and Just Sold — overlaid on your map with owner data and comps. Click a listing. Call the block. Circle prospect with full context.
              </p>

              {/* Trust checkmarks */}
              <div className="space-y-3 mb-8">
                {[
                  'Solds, Actives & Pendings live on your map — see what just happened',
                  'Click any listing, see every neighbor with owner data and comps',
                  'Walk the block in Street View before you dial',
                ].map((point) => (
                  <div key={point} className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-emerald-400 text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    <span className="text-sm sm:text-base text-slate-300 font-medium">{point}</span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-lg font-bold font-headline text-base sm:text-lg text-center hover:shadow-[0_0_20px_rgba(195,192,255,0.3)] transition-all">
                  Claim My 50 Free Credits
                </Link>
                <a href="#features" className="bg-[#23293c] border border-slate-700/20 text-[#dce1fb] px-6 sm:px-8 py-3.5 sm:py-4 rounded-lg font-bold font-headline text-base sm:text-lg text-center hover:bg-[#2e3447] transition-all flex items-center justify-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>visibility</span>
                  See How It Works
                </a>
              </div>
            </div>
            {/* Hero image — hidden on mobile, shown on lg+ */}
            <div className="hidden lg:block relative">
              <div className="bg-[#151b2d] rounded-xl p-2 border border-slate-700/10 shadow-2xl relative overflow-hidden aspect-[4/3]">
                <img className="w-full h-full object-cover rounded-lg" alt="Plot Maps Walk Mode with name tags on houses" src="/hero-walkmode-nametags.png" loading="lazy" />
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-16 sm:py-24 bg-[#151b2d]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-headline font-extrabold mb-4 sm:mb-6">Prospecting shouldn&apos;t require 5 different tools.</h2>
              <p className="text-slate-400 text-base sm:text-lg">The old way is slow, fragmented, and costs you deals.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-6 sm:gap-8">
              {[
                { icon: 'tab_unselected', title: 'Context Switching', desc: 'Constant jumping between your CRM, MLS, Google Maps, and dialer kills your momentum.' },
                { icon: 'wrong_location', title: 'Blind Outreach', desc: 'Calling owners without seeing the condition of the house or the surrounding comps in real-time.' },
                { icon: 'link_off', title: 'Disconnected Data', desc: 'Property info is in one sheet, owner data in another. Nothing talks to each other.' },
              ].map((item) => (
                <div key={item.title} className="p-6 sm:p-8 bg-[#0c1324] rounded-xl border border-slate-700/10">
                  <span className="material-symbols-outlined text-orange-400 mb-4 sm:mb-6" style={{ fontSize: '36px' }}>{item.icon}</span>
                  <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed text-sm sm:text-base">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Tabbed Features Section */}
        <section id="features" className="py-16 sm:py-24 bg-[#070d1f]">
          <div className="max-w-4xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-10 sm:mb-14">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-headline font-extrabold mb-3 sm:mb-4">Built for Precision Prospecting</h2>
              <p className="text-slate-400 text-sm sm:text-base">Know who to call, why to call, and what to say.</p>
            </div>

            {/* Tab Switcher */}
            <div className="flex bg-[#0c1324] p-1 rounded-xl mb-8 border border-slate-700/10">
              {([
                { key: 'map' as const, label: 'Map CRM' },
                { key: 'walk' as const, label: 'Walk Mode' },
                { key: 'intel' as const, label: 'Market Intel' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setFeatureTab(key)}
                  className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${
                    featureTab === key
                      ? 'bg-indigo-600 text-white shadow-lg'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="bg-[#23293c]/40 backdrop-blur rounded-2xl border border-slate-700/20 p-6 sm:p-8 min-h-[400px]">
              {featureTab === 'map' && (
                <div>
                  <div className="mb-6">
                    <span className="bg-indigo-400/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Visual First</span>
                    <h3 className="text-xl sm:text-2xl font-bold mt-4 mb-3">Map-Based CRM</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">Every property becomes a clickable pin. Track your entire pipeline geographically. See patterns others miss. Upload from PropWire, BatchLeads, or your MLS — mapped instantly.</p>
                  </div>
                  <div className="overflow-hidden rounded-xl h-48 sm:h-64 bg-[#0c1324]">
                    <img className="w-full h-full object-cover" alt="Plot Maps aerial map with property popup and script" src="/feature-aerial-popup.png" loading="lazy" />
                  </div>
                </div>
              )}
              {featureTab === 'walk' && (
                <div>
                  <div className="mb-6">
                    <span className="bg-indigo-400/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">The Game Changer</span>
                    <h3 className="text-xl sm:text-2xl font-bold mt-4 mb-3">Walk Mode</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">Virtually walk neighborhoods with Street View. See the house, the yard, the neighborhood — then call with visual context that sets you apart from every other prospector.</p>
                  </div>
                  <div className="overflow-hidden rounded-xl h-48 sm:h-64 bg-[#0c1324]">
                    <img className="w-full h-full object-cover object-center" alt="Plot Maps Walk Mode on Eagle Street" src="/hero-walkmode-eagle.png" loading="lazy" />
                  </div>
                </div>
              )}
              {featureTab === 'intel' && (
                <div>
                  <div className="mb-6">
                    <span className="bg-orange-400/10 text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Context</span>
                    <h3 className="text-xl sm:text-2xl font-bold mt-4 mb-3">Market Intelligence</h3>
                    <p className="text-slate-400 text-sm sm:text-base leading-relaxed">See nearby solds, actives, and pendings overlaid on your map. Every property card shows comps, talking points, and owner data — so every call starts with context, not a cold open.</p>
                  </div>
                  <div className="overflow-hidden rounded-xl h-48 sm:h-64 bg-[#0c1324]">
                    <img className="w-full h-full object-cover" alt="Plot Maps sold property popup with talking points" src="/feature-sold-popup.png" loading="lazy" />
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section id="use-cases" className="py-16 sm:py-24">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-12 text-center">
              {[
                { icon: 'real_estate_agent', title: 'Agents', desc: 'Master your farm area with visual data.' },
                { icon: 'home_work', title: 'Investors', desc: 'Identify distressed assets from your desk.' },
                { icon: 'storefront', title: 'Wholesalers', desc: 'Targeted outreach with zero friction.' },
                { icon: 'groups', title: 'Teams', desc: 'Collaborate and conquer zip codes.' },
              ].map((item) => (
                <div key={item.title}>
                  <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#23293c] rounded-2xl flex items-center justify-center mx-auto mb-4 sm:mb-6 text-indigo-400">
                    <span className="material-symbols-outlined" style={{ fontSize: '28px' }}>{item.icon}</span>
                  </div>
                  <h4 className="font-bold text-sm sm:text-lg mb-1 sm:mb-2">{item.title}</h4>
                  <p className="text-xs sm:text-sm text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16 sm:py-24 bg-[#151b2d]">
          <div className="max-w-6xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-headline font-extrabold mb-3 sm:mb-4">Simple pricing. No surprises.</h2>
              <p className="text-slate-400 text-base sm:text-lg">Start free with 10 skip traces and 50 geocodes. No credit card required.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4 sm:gap-6">
              {/* Basic */}
              <div className="bg-[#0c1324] rounded-2xl p-5 sm:p-7 border border-slate-700/10">
                <h3 className="text-lg sm:text-xl font-bold">Basic</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold">$79</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                <ul className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3">
                  {[
                    '50 skip traces / month',
                    '500 geocodes / month',
                    'Interactive Map + Walk Mode',
                    'MLS overlay (Solds, Actives, Pendings)',
                    'Call scripts & notes',
                    'Manual dialing (use your phone)',
                    '500 Street View loads / month',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className="material-symbols-outlined text-emerald-400 text-[14px] mt-0.5 shrink-0">check_circle</span>
                      <span className="text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="block w-full text-center mt-5 sm:mt-7 py-3 rounded-xl bg-[#23293c] text-white font-bold hover:bg-[#2e3447] transition-colors text-sm">
                  Start Free
                </Link>
              </div>
              {/* Standard — Most Popular */}
              <div className="bg-[#0c1324] rounded-2xl p-5 sm:p-7 border-2 border-indigo-500 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-[10px] font-bold px-3 py-1 rounded-full">
                  Most Popular
                </div>
                <h3 className="text-lg sm:text-xl font-bold">Standard</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold">$99</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                <ul className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3">
                  {[
                    '150 skip traces / month',
                    '1,500 geocodes / month',
                    'Browser Dialer — call from the app',
                    'Local phone number included',
                    '500 calling minutes / month',
                    'Unlimited Street View loads',
                    'Everything in Basic',
                  ].map((f, i) => (
                    <li key={f} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className={`material-symbols-outlined text-[14px] mt-0.5 shrink-0 ${i === 6 ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        {i === 6 ? 'star' : 'check_circle'}
                      </span>
                      <span className={i === 6 ? 'text-white font-bold' : 'text-slate-300'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="block w-full text-center mt-5 sm:mt-7 py-3 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold hover:shadow-[0_0_20px_rgba(195,192,255,0.3)] transition-all text-sm">
                  Start Free
                </Link>
              </div>
              {/* Pro */}
              <div className="bg-[#0c1324] rounded-2xl p-5 sm:p-7 border border-slate-700/10">
                <h3 className="text-lg sm:text-xl font-bold">Pro</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl sm:text-4xl font-extrabold">$149</span>
                  <span className="text-slate-500">/mo</span>
                </div>
                <ul className="mt-5 sm:mt-6 space-y-2.5 sm:space-y-3">
                  {[
                    '500 skip traces / month',
                    '5,000 geocodes / month',
                    'Browser Dialer + 1,000 minutes',
                    'Local phone number included',
                    'Unlimited Street View loads',
                    'Priority support',
                    'Everything in Standard',
                  ].map((f, i) => (
                    <li key={f} className="flex items-start gap-2 text-xs sm:text-sm">
                      <span className={`material-symbols-outlined text-[14px] mt-0.5 shrink-0 ${i === 6 ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        {i === 6 ? 'star' : 'check_circle'}
                      </span>
                      <span className={i === 6 ? 'text-white font-bold' : 'text-slate-300'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="block w-full text-center mt-5 sm:mt-7 py-3 rounded-xl bg-[#23293c] text-white font-bold hover:bg-[#2e3447] transition-colors text-sm">
                  Start Free
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-20 sm:py-32 bg-gradient-to-t from-[#070d1f] to-[#0c1324] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <img className="w-full h-full object-cover" alt="" src="/hero-map.jpg" loading="lazy" />
          </div>
          <div className="max-w-4xl mx-auto px-5 sm:px-8 relative z-10 text-center">
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-headline font-extrabold mb-4 sm:mb-6">Circle prospect like nobody else.</h2>
            <p className="text-lg sm:text-2xl text-slate-400 mb-8 sm:mb-12">See the listing. See the neighbors. Make the call.</p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-6">
              <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-lg font-bold font-headline text-lg sm:text-xl shadow-xl hover:scale-105 transition-all text-center">
                Claim My Free Credits
              </Link>
              <Link href="/signup" className="bg-[#23293c] border border-slate-700/30 text-[#dce1fb] px-8 sm:px-10 py-4 sm:py-5 rounded-lg font-bold font-headline text-lg sm:text-xl hover:bg-[#2e3447] transition-all text-center">
                Start Prospecting
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#070d1f] w-full py-10 sm:py-12 px-5 sm:px-8 border-t border-indigo-900/20">
        <div className="max-w-7xl mx-auto grid gap-8 sm:gap-10 grid-cols-2 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="text-lg font-bold text-indigo-200 font-headline">Plot Maps</div>
            <p className="mt-3 text-sm text-slate-400 leading-relaxed">
              Visual prospecting software for agents, investors, wholesalers, and outreach teams.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-indigo-100 mb-3">Product</h4>
            <div className="flex flex-col gap-2 text-sm text-slate-400">
              <a href="#features" className="hover:text-indigo-400 transition-colors">Features</a>
              <a href="#pricing" className="hover:text-indigo-400 transition-colors">Pricing</a>
              <a href="/support" className="hover:text-indigo-400 transition-colors">Support</a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-indigo-100 mb-3">Company</h4>
            <div className="flex flex-col gap-2 text-sm text-slate-400">
              <Link href="/support" className="hover:text-indigo-400 transition-colors">Support</Link>
              <Link href="/login" className="hover:text-indigo-400 transition-colors">Sign In</Link>
              <Link href="/signup" className="hover:text-indigo-400 transition-colors">Sign Up</Link>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-indigo-100 mb-3">Legal</h4>
            <div className="flex flex-col gap-2 text-sm text-slate-400">
              <Link href="/privacy" className="hover:text-indigo-400 transition-colors">Privacy Policy</Link>
              <Link href="/terms" className="hover:text-indigo-400 transition-colors">Terms of Service</Link>
              <Link href="/cookies" className="hover:text-indigo-400 transition-colors">Cookie Policy</Link>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-8 sm:mt-10 pt-6 border-t border-slate-800 flex flex-col md:flex-row justify-between gap-4 text-xs text-slate-500">
          <p>&copy; 2026 Plot Maps by Plot Solutions. All rights reserved.</p>
          <p>
            Support:{' '}
            <a href="mailto:gregfranklin523@gmail.com" className="hover:text-indigo-400 transition-colors">
              gregfranklin523@gmail.com
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
