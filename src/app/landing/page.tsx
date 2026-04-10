'use client';

import Link from 'next/link';

export default function LandingPage() {
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
          <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-bold font-headline text-sm sm:text-base scale-95 hover:scale-100 transition-all duration-300">
            Get Access
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero Section — mobile-first: text + CTA above fold, image hidden on small screens */}
        <section className="relative pt-24 sm:pt-40 pb-16 sm:pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-8 grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div className="relative z-10">
              <h1 className="text-3xl sm:text-5xl lg:text-7xl font-headline font-extrabold tracking-tight leading-[1.1] mb-4 sm:mb-8">
                Know exactly who to call — <span className="text-indigo-400">and why.</span>
              </h1>
              <p className="text-base sm:text-xl text-slate-400 leading-relaxed mb-6 sm:mb-8 max-w-xl">
                See every property on a map with comps, owner data, and talking points. Stop calling blind — prospect with full context from street level.
              </p>
              {/* Trust signal */}
              <p className="text-sm text-indigo-300/80 mb-6 sm:mb-8 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-400 text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                50 free geocodes. No credit card required.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-lg font-bold font-headline text-base sm:text-lg text-center hover:shadow-[0_0_20px_rgba(195,192,255,0.3)] transition-all">
                  Start Prospecting Free
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

        {/* Solution Section */}
        <section className="py-20 sm:py-32 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
              <div className="flex-1 order-2 lg:order-1">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {[
                    { icon: 'upload_file', label: 'Upload List' },
                    { icon: 'map', label: 'Instantly Mapped' },
                    { icon: 'phone_forwarded', label: 'Click to Call' },
                    { icon: 'analytics', label: 'Live Comps' },
                  ].map((item) => (
                    <div key={item.label} className="aspect-square bg-[#23293c] rounded-2xl p-4 sm:p-6 flex flex-col justify-end border border-slate-700/10">
                      <span className="material-symbols-outlined text-indigo-400 mb-3 sm:mb-4" style={{ fontSize: '28px' }}>{item.icon}</span>
                      <div className="font-bold text-sm sm:text-base">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 order-1 lg:order-2">
                <h2 className="text-3xl sm:text-4xl lg:text-6xl font-headline font-extrabold mb-6 sm:mb-8 leading-tight">One system. One view. <br /><span className="text-indigo-400">Total context.</span></h2>
                <p className="text-base sm:text-xl text-slate-400 mb-8 sm:mb-10 leading-relaxed">
                  Upload your list from any source — PropWire, BatchLeads, or your MLS — and see it instantly geocoded on a beautiful, fast interface designed for action.
                </p>
                <ul className="space-y-4 sm:space-y-6">
                  <li className="flex items-start gap-3 sm:gap-4">
                    <div className="mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-400/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-indigo-400 text-xs sm:text-sm">check</span>
                    </div>
                    <span className="text-base sm:text-lg">No more data silos. Your workflow lives inside the map.</span>
                  </li>
                  <li className="flex items-start gap-3 sm:gap-4">
                    <div className="mt-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-indigo-400/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-indigo-400 text-xs sm:text-sm">check</span>
                    </div>
                    <span className="text-base sm:text-lg">Prospect at 3x the speed with integrated street-view workflows.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-16 sm:py-24 bg-[#070d1f]">
          <div className="max-w-7xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-12 sm:mb-20">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-headline font-extrabold mb-3 sm:mb-4">Built for Precision Prospecting</h2>
              <p className="text-slate-400 text-sm sm:text-base">Know who to call, why to call, and what to say.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-4 sm:gap-6">
              <div className="md:col-span-3 bg-[#23293c] rounded-2xl p-6 sm:p-8 flex flex-col border border-slate-700/5">
                <div>
                  <span className="bg-indigo-400/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Visual First</span>
                  <h3 className="text-xl sm:text-2xl font-bold mt-4 mb-3 sm:mb-4">Map-Based CRM</h3>
                  <p className="text-slate-400 text-sm sm:text-base">Every property becomes a clickable pin. Track your entire pipeline geographically. See patterns others miss.</p>
                </div>
                <div className="mt-6 sm:mt-8 overflow-hidden rounded-xl h-36 sm:h-48 bg-[#0c1324]">
                  <img className="w-full h-full object-cover" alt="Plot Maps aerial map with property popup and script" src="/feature-aerial-popup.png" loading="lazy" />
                </div>
              </div>
              <div className="md:col-span-3 bg-[#23293c] rounded-2xl p-6 sm:p-8 flex flex-col border border-slate-700/5">
                <div>
                  <span className="bg-orange-400/10 text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Context</span>
                  <h3 className="text-xl sm:text-2xl font-bold mt-4 mb-3 sm:mb-4">Call With Confidence</h3>
                  <p className="text-slate-400 text-sm sm:text-base">See nearby comps, talking points, and owner data before you dial. Every call starts with context, not a cold open.</p>
                </div>
                <div className="mt-6 sm:mt-8 overflow-hidden rounded-xl h-36 sm:h-48 bg-[#0c1324]">
                  <img className="w-full h-full object-cover" alt="Plot Maps sold property popup with talking points" src="/feature-sold-popup.png" loading="lazy" />
                </div>
              </div>
              <div className="md:col-span-2 bg-gradient-to-br from-indigo-600/40 to-[#23293c] rounded-2xl p-6 sm:p-8 border border-indigo-500/10 flex flex-col">
                <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">The Game Changer</span>
                <h3 className="text-xl sm:text-2xl font-bold mt-4 mb-3 sm:mb-4">Walk Mode</h3>
                <p className="text-slate-400 text-sm sm:text-base mb-4">Virtually walk neighborhoods with Street View. Call while you &quot;stroll&quot; to add visual detail to every pitch.</p>
                <div className="mt-auto overflow-hidden rounded-xl h-28 sm:h-36 bg-[#0c1324]">
                  <img className="w-full h-full object-cover object-center" alt="Plot Maps Walk Mode on Eagle Street" src="/hero-walkmode-eagle.png" loading="lazy" />
                </div>
              </div>
              <div className="md:col-span-2 bg-[#23293c] rounded-2xl p-6 sm:p-8 border border-slate-700/5 flex flex-col">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Market Intelligence</h3>
                <p className="text-slate-400 text-sm mb-4">See nearby solds and actives instantly. Be the expert on every block without checking Zillow.</p>
                <div className="mt-auto overflow-hidden rounded-xl h-28 sm:h-36 bg-[#0c1324]">
                  <img className="w-full h-full object-cover object-top" alt="Plot Maps aerial sold property data" src="/feature-aerial-sold.png" loading="lazy" />
                </div>
              </div>
              <div className="md:col-span-2 bg-[#23293c] rounded-2xl p-6 sm:p-8 border border-slate-700/5">
                <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">AI Follow-Up</h3>
                <p className="text-slate-400 text-sm">Know who to call next based on property signals and engagement history.</p>
              </div>
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
          <div className="max-w-5xl mx-auto px-5 sm:px-8">
            <div className="text-center mb-10 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl lg:text-5xl font-headline font-extrabold mb-3 sm:mb-4">Simple pricing. No surprises.</h2>
              <p className="text-slate-400 text-base sm:text-lg">Start free with 50 geocodes. No credit card required.</p>
            </div>
            <div className="grid md:grid-cols-2 gap-6 sm:gap-8">
              {/* Starter */}
              <div className="bg-[#0c1324] rounded-2xl p-6 sm:p-8 border border-slate-700/10">
                <h3 className="text-xl sm:text-2xl font-bold">Starter</h3>
                <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold">$49</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <ul className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
                  {[
                    'Interactive 3D Map View',
                    'Walk Mode — Street View Prospecting',
                    'Import your own property lists',
                    'MLS data overlay (Sold / Active / Pending)',
                    'Call scripts & notes',
                    'AI follow-up suggestions',
                    'Manual dialing (use your phone)',
                    '500 geocodes / month',
                    '1,000 street view loads / month',
                    '$0.01/geocode overage available',
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm">
                      <span className="material-symbols-outlined text-emerald-400 text-[14px] sm:text-[16px] mt-0.5 shrink-0">check_circle</span>
                      <span className="text-slate-300">{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="block w-full text-center mt-6 sm:mt-8 py-3 rounded-xl bg-[#23293c] text-white font-bold hover:bg-[#2e3447] transition-colors text-sm sm:text-base">
                  Get Started Free
                </Link>
              </div>
              {/* Pro */}
              <div className="bg-[#0c1324] rounded-2xl p-6 sm:p-8 border-2 border-indigo-500 relative">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                  Most Popular
                </div>
                <h3 className="text-xl sm:text-2xl font-bold">Pro</h3>
                <div className="mt-3 sm:mt-4 flex items-baseline gap-1">
                  <span className="text-4xl sm:text-5xl font-extrabold">$79</span>
                  <span className="text-slate-500">/month</span>
                </div>
                <ul className="mt-6 sm:mt-8 space-y-3 sm:space-y-4">
                  {[
                    'Everything in Starter, plus:',
                    'Browser Dialer — click to call from the app',
                    'Local phone number included',
                    'Call recording',
                    'Full call analytics dashboard',
                    '1,000 calling minutes / month',
                    '2,000 geocodes / month',
                    'Unlimited street view loads',
                    'Priority support',
                  ].map((f, i) => (
                    <li key={f} className="flex items-start gap-2 sm:gap-3 text-xs sm:text-sm">
                      <span className={`material-symbols-outlined text-[14px] sm:text-[16px] mt-0.5 shrink-0 ${i === 0 ? 'text-indigo-400' : 'text-emerald-400'}`}>
                        {i === 0 ? 'star' : 'check_circle'}
                      </span>
                      <span className={i === 0 ? 'text-white font-bold' : 'text-slate-300'}>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link href="/signup" className="block w-full text-center mt-6 sm:mt-8 py-3 rounded-xl bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold hover:shadow-[0_0_20px_rgba(195,192,255,0.3)] transition-all text-sm sm:text-base">
                  Get Started Free
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
            <h2 className="text-3xl sm:text-4xl lg:text-6xl font-headline font-extrabold mb-4 sm:mb-6">Stop prospecting blind.</h2>
            <p className="text-lg sm:text-2xl text-slate-400 mb-8 sm:mb-12">See the house. See the data. Make the call.</p>
            <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-4 sm:gap-6">
              <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-8 sm:px-10 py-4 sm:py-5 rounded-lg font-bold font-headline text-lg sm:text-xl shadow-xl hover:scale-105 transition-all text-center">
                Get Access
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
          <p>© 2026 Plot Maps by Plot Solutions. All rights reserved.</p>
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
