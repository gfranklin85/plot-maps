'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="bg-[#0c1324] text-[#dce1fb] min-h-screen font-body selection:bg-indigo-500/30 scroll-smooth">
      {/* Top Navigation */}
      <header className="fixed top-0 w-full z-50 bg-[#0c1324]/80 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.12)]">
        <nav className="flex justify-between items-center px-8 py-4 max-w-screen-2xl mx-auto">
          <div className="text-2xl font-black tracking-tighter text-indigo-100 font-headline">Plot Maps</div>
          <div className="hidden md:flex items-center gap-8">
            <button onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })} className="text-indigo-400 font-semibold border-b-2 border-indigo-500 pb-1 font-headline">Features</button>
            <Link className="text-slate-400 font-medium hover:text-indigo-200 transition-colors font-headline" href="/subscribe">Pricing</Link>
            <button onClick={() => document.getElementById('use-cases')?.scrollIntoView({ behavior: 'smooth' })} className="text-slate-400 font-medium hover:text-indigo-200 transition-colors font-headline">Use Cases</button>
            <Link className="text-slate-400 font-medium hover:text-indigo-200 transition-colors font-headline" href="/login">Sign In</Link>
          </div>
          <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold font-headline scale-95 hover:scale-100 transition-all duration-300">
            Get Access
          </Link>
        </nav>
      </header>

      <main>
        {/* Hero Section */}
        <section className="relative pt-40 pb-32 overflow-hidden">
          <div className="max-w-7xl mx-auto px-8 grid lg:grid-cols-2 gap-16 items-center">
            <div className="relative z-10">
              <h1 className="text-5xl lg:text-7xl font-headline font-extrabold tracking-tight leading-[1.1] mb-8">
                Call property owners while <span className="text-indigo-400">looking</span> at their house.
              </h1>
              <p className="text-xl text-slate-400 leading-relaxed mb-12 max-w-xl">
                Plot Maps lets you upload your property lists, see every house on a map, and prospect directly from street level — with comps, scripts, and owner data all in one place.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-8 py-4 rounded-lg font-bold font-headline text-lg hover:shadow-[0_0_20px_rgba(195,192,255,0.3)] transition-all">
                  Get Access
                </Link>
                <Link href="/signup" className="bg-[#23293c] border border-slate-700/20 text-[#dce1fb] px-8 py-4 rounded-lg font-bold font-headline text-lg hover:bg-[#2e3447] transition-all flex items-center gap-2">
                  <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>play_circle</span>
                  Watch Demo
                </Link>
              </div>
            </div>
            <div className="relative">
              <div className="bg-[#151b2d] rounded-xl p-2 border border-slate-700/10 shadow-2xl relative overflow-hidden aspect-[4/3]">
                <img className="w-full h-full object-cover rounded-lg opacity-80" alt="Modern dark mode satellite map interface" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCcKIQjj7ghvniz3cy8nS2X4rxK-aMqfkYOCNqXxyx327e29uoENFt8aMKWcmlA4em7rbYtzAcHHAHGPgpgkV2QBq2eX1YeFCbw4k_zuXfmc16uk2_0fXYAoqInbUCJtTFQrPZhrJOQ80alkw3y7zcrIDsEg71faWsBH8fFlfIybzoExGmnlJPvOLIaAZi1Lc7wF_r3wkxHzbFjwb2BzK7w4ALD1zxKCDgKPVbtt4O4gQLm8JInK4N67u5MB3HMP5NEyuYagpgyWtY" />
                {/* Floating Call Cockpit */}
                <div className="absolute top-8 right-8 w-64 backdrop-blur-xl bg-[#2e3447]/40 rounded-xl p-4 border border-slate-700/20 shadow-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center">
                      <span className="material-symbols-outlined text-white" style={{ fontVariationSettings: "'FILL' 1" }}>call</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Active Call</div>
                      <div className="text-sm font-semibold">Robert J. Smith</div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-4">
                    <div className="h-2 w-full bg-[#2e3447] rounded-full overflow-hidden">
                      <div className="h-full w-2/3 bg-indigo-400"></div>
                    </div>
                    <div className="text-[10px] text-slate-500">02:45 • Intro Script Active</div>
                  </div>
                  <button className="w-full py-2 bg-red-900 text-white rounded-lg text-xs font-bold">End Prospecting</button>
                </div>
                {/* Info Lens */}
                <div className="absolute bottom-8 left-8 backdrop-blur-xl bg-[#2e3447]/40 rounded-xl p-5 border border-slate-700/20 shadow-2xl max-w-[280px]">
                  <h4 className="font-headline font-bold mb-1">1248 Oak Creek Dr.</h4>
                  <p className="text-xs text-slate-500 mb-4">Potential Flip • Vacant 2 years</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-tighter text-slate-500">Est. Value</div>
                      <div className="text-sm font-bold text-indigo-400">$842k</div>
                    </div>
                    <div>
                      <div className="text-[10px] uppercase tracking-tighter text-slate-500">Equity</div>
                      <div className="text-sm font-bold text-orange-400">64%</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Section */}
        <section className="py-24 bg-[#151b2d]">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl lg:text-5xl font-headline font-extrabold mb-6">Prospecting shouldn&apos;t require 5 different tools.</h2>
              <p className="text-slate-400 text-lg">The old way is slow, fragmented, and costs you deals.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                { icon: 'tab_unselected', title: 'Context Switching', desc: 'Constant jumping between your CRM, MLS, Google Maps, and dialer kills your momentum.' },
                { icon: 'wrong_location', title: 'Blind Outreach', desc: 'Calling owners without seeing the condition of the house or the surrounding comps in real-time.' },
                { icon: 'link_off', title: 'Disconnected Data', desc: 'Property info is in one sheet, owner data in another. Nothing talks to each other.' },
              ].map((item) => (
                <div key={item.title} className="p-8 bg-[#0c1324] rounded-xl border border-slate-700/10">
                  <span className="material-symbols-outlined text-orange-400 mb-6" style={{ fontSize: '40px' }}>{item.icon}</span>
                  <h3 className="text-xl font-bold mb-4">{item.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Solution Section */}
        <section className="py-32 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-8">
            <div className="flex flex-col lg:flex-row items-center gap-20">
              <div className="flex-1 order-2 lg:order-1">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { icon: 'upload_file', label: 'Upload List' },
                    { icon: 'map', label: 'Instantly Mapped' },
                    { icon: 'phone_forwarded', label: 'Click to Call' },
                    { icon: 'analytics', label: 'Live Comps' },
                  ].map((item) => (
                    <div key={item.label} className="aspect-square bg-[#23293c] rounded-2xl p-6 flex flex-col justify-end border border-slate-700/10">
                      <span className="material-symbols-outlined text-indigo-400 mb-4" style={{ fontSize: '32px' }}>{item.icon}</span>
                      <div className="font-bold">{item.label}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex-1 order-1 lg:order-2">
                <h2 className="text-4xl lg:text-6xl font-headline font-extrabold mb-8 leading-tight">One system. One view. <br /><span className="text-indigo-400">Total context.</span></h2>
                <p className="text-xl text-slate-400 mb-10 leading-relaxed">
                  Upload your list from any source—PropWire, BatchLeads, or your MLS—and see it instantly geocoded on a beautiful, fast interface designed for action.
                </p>
                <ul className="space-y-6">
                  <li className="flex items-start gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-indigo-400/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-indigo-400 text-sm">check</span>
                    </div>
                    <span className="text-lg">No more data silos. Your workflow lives inside the map.</span>
                  </li>
                  <li className="flex items-start gap-4">
                    <div className="mt-1 w-6 h-6 rounded-full bg-indigo-400/20 flex items-center justify-center flex-shrink-0">
                      <span className="material-symbols-outlined text-indigo-400 text-sm">check</span>
                    </div>
                    <span className="text-lg">Prospect at 3x the speed with integrated street-view workflows.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section id="features" className="py-24 bg-[#070d1f]">
          <div className="max-w-7xl mx-auto px-8">
            <div className="text-center mb-20">
              <h2 className="text-3xl lg:text-5xl font-headline font-extrabold mb-4">Precision Engineering for Pros</h2>
              <p className="text-slate-400">Built for teams that dominate their local market.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
              <div className="md:col-span-3 bg-[#23293c] rounded-2xl p-8 flex flex-col border border-slate-700/5">
                <div>
                  <span className="bg-indigo-400/10 text-indigo-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Visual First</span>
                  <h3 className="text-2xl font-bold mt-4 mb-4">Map-Based CRM</h3>
                  <p className="text-slate-400">Every property becomes a clickable pin. Track your entire pipeline geographically. See patterns others miss.</p>
                </div>
                <div className="mt-8 overflow-hidden rounded-xl h-48 bg-[#0c1324]">
                  <img className="w-full h-full object-cover opacity-60" alt="Map-based CRM visualization" src="https://lh3.googleusercontent.com/aida-public/AB6AXuCsX_Oti1jlPIPvBJJYXj_YkCVbsUKucFNR_XiQN13TjWEN-3IZ6ZPliC4Nh_wpoeHqjxQckSZi08SoM9YoVFpQNRXbgfvwk79j-w2nRwRv76cXeeZRWsExoxNZShKThbclheqNtuGQbPdGOD9-XMkpCGppJ79VXgGlwqOh9J-Ce1CB29C4zwxY33C2YP-pemiNJWuysT2u3q9aCTe1f76ygy4hNQbnjNHGAfVTZW7fp0gZ8MEZVv_iXwJ_aSb9bUjAnImoEbKKoew" />
                </div>
              </div>
              <div className="md:col-span-3 bg-[#23293c] rounded-2xl p-8 flex flex-col border border-slate-700/5">
                <div>
                  <span className="bg-orange-400/10 text-orange-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">Efficiency</span>
                  <h3 className="text-2xl font-bold mt-4 mb-4">Call Cockpit</h3>
                  <p className="text-slate-400">Integrated dialer with dynamic scripts and rapid-fire logging. Never lose your place in a neighborhood again.</p>
                </div>
                <div className="mt-8 flex gap-4">
                  <div className="flex-1 h-32 bg-[#0c1324] rounded-lg flex items-center justify-center border border-indigo-500/20">
                    <span className="material-symbols-outlined text-indigo-400 text-4xl">mic</span>
                  </div>
                  <div className="flex-[2] h-32 bg-[#0c1324] rounded-lg p-4 space-y-2 border border-slate-700/10">
                    <div className="h-2 w-full bg-[#2e3447] rounded"></div>
                    <div className="h-2 w-3/4 bg-[#2e3447] rounded"></div>
                    <div className="h-2 w-1/2 bg-[#2e3447] rounded"></div>
                  </div>
                </div>
              </div>
              <div className="md:col-span-2 bg-gradient-to-br from-indigo-600/40 to-[#23293c] rounded-2xl p-8 border border-indigo-500/10">
                <span className="bg-white/10 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest">The Game Changer</span>
                <h3 className="text-2xl font-bold mt-4 mb-4">Walk Mode</h3>
                <p className="text-slate-400">Virtually walk neighborhoods with Street View. Call while you &quot;stroll&quot; to add visual detail to every pitch.</p>
              </div>
              <div className="md:col-span-2 bg-[#23293c] rounded-2xl p-8 border border-slate-700/5">
                <h3 className="text-xl font-bold mb-4">Market Intelligence</h3>
                <p className="text-slate-400 text-sm">See nearby solds and actives instantly. Be the expert on every block without checking Zillow.</p>
              </div>
              <div className="md:col-span-2 bg-[#23293c] rounded-2xl p-8 border border-slate-700/5">
                <h3 className="text-xl font-bold mb-4">AI Follow-Up</h3>
                <p className="text-slate-400 text-sm">Know who to call next based on property signals and engagement history.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section id="use-cases" className="py-24">
          <div className="max-w-7xl mx-auto px-8">
            <div className="grid lg:grid-cols-4 gap-12 text-center">
              {[
                { icon: 'real_estate_agent', title: 'Agents', desc: 'Master your farm area with visual data.' },
                { icon: 'home_work', title: 'Investors', desc: 'Identify distressed assets from your desk.' },
                { icon: 'storefront', title: 'Wholesalers', desc: 'High-volume outreach with zero friction.' },
                { icon: 'groups', title: 'Outreach Teams', desc: 'Collaborate and conquer zip codes.' },
              ].map((item) => (
                <div key={item.title}>
                  <div className="w-16 h-16 bg-[#23293c] rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-400">
                    <span className="material-symbols-outlined" style={{ fontSize: '32px' }}>{item.icon}</span>
                  </div>
                  <h4 className="font-bold text-lg mb-2">{item.title}</h4>
                  <p className="text-sm text-slate-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-32 bg-gradient-to-t from-[#070d1f] to-[#0c1324] relative overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <img className="w-full h-full object-cover" alt="" src="https://lh3.googleusercontent.com/aida-public/AB6AXuB5I3lYfnCULeCN9GFjMBOcaM3snY2PG5mjaiuN4rU8NskTS84BajR3318zBNaFlvMNjqvEl1pAspymPMJEOznDLiINM8JhnEn7pA9k1jK4bsFEqUfFW-xjBC-S7T6LQLqVDM-YJYT5Pr2vi234KSsC2YJJ62UcOLDhAudpyP6ODZmftSZHKnQEqNCppU3B_TtdUj5b28rR7bbAn70aUgqsMn1zJK9f_xRic84n_bFUpZ7Rb-Ac7I27erVbZVjlcqNg3r7be0RYXHk" />
          </div>
          <div className="max-w-4xl mx-auto px-8 relative z-10 text-center">
            <h2 className="text-4xl lg:text-6xl font-headline font-extrabold mb-6">Stop prospecting blind.</h2>
            <p className="text-2xl text-slate-400 mb-12">See the house. See the data. Make the call.</p>
            <div className="flex flex-wrap justify-center gap-6">
              <Link href="/signup" className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white px-10 py-5 rounded-lg font-bold font-headline text-xl shadow-xl hover:scale-105 transition-all">
                Get Access
              </Link>
              <Link href="/signup" className="bg-[#23293c] border border-slate-700/30 text-[#dce1fb] px-10 py-5 rounded-lg font-bold font-headline text-xl hover:bg-[#2e3447] transition-all">
                Start Prospecting
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-[#070d1f] w-full py-12 px-8 border-t border-indigo-900/20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 max-w-7xl mx-auto">
          <div className="text-lg font-bold text-indigo-200 font-headline">Plot Maps</div>
          <div className="flex flex-wrap justify-center gap-6 text-sm tracking-wide text-slate-500">
            <a className="hover:text-indigo-400 transition-colors" href="#">Privacy Policy</a>
            <a className="hover:text-indigo-400 transition-colors" href="#">Terms of Service</a>
            <a className="hover:text-indigo-400 transition-colors" href="#">Support</a>
          </div>
          <p className="text-slate-500 text-xs text-center md:text-right">
            &copy; 2026 Plot Maps by Plot Solutions. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
