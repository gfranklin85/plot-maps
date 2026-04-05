'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface AvailableNumber {
  phoneNumber: string;
  friendlyName: string;
  locality: string;
  region: string;
}

export default function SetupNumberPage() {
  const router = useRouter();
  const [areaCode, setAreaCode] = useState('559');
  const [searching, setSearching] = useState(false);
  const [numbers, setNumbers] = useState<AvailableNumber[]>([]);
  const [selected, setSelected] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function searchNumbers() {
    setSearching(true);
    setError('');
    setNumbers([]);
    try {
      const res = await fetch(`/api/twilio/provision?areaCode=${areaCode}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setNumbers(data.numbers || []);
      if (data.numbers?.length > 0) setSelected(data.numbers[0].phoneNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to search numbers');
    } finally {
      setSearching(false);
    }
  }

  async function claimNumber() {
    if (!selected) return;
    setProvisioning(true);
    setError('');
    try {
      const res = await fetch('/api/twilio/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: selected }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setDone(true);
      setTimeout(() => router.push('/map'), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to provision number');
    } finally {
      setProvisioning(false);
    }
  }

  function formatPhone(num: string): string {
    const cleaned = num.replace(/\D/g, '');
    if (cleaned.length === 11 && cleaned[0] === '1') {
      return `(${cleaned.slice(1, 4)}) ${cleaned.slice(4, 7)}-${cleaned.slice(7)}`;
    }
    return num;
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#0c1324] flex items-center justify-center">
        <div className="text-center">
          <MaterialIcon icon="check_circle" className="text-[72px] text-emerald-500 mb-4" />
          <h2 className="text-2xl font-bold text-white font-headline">Number Claimed!</h2>
          <p className="text-slate-400 mt-2">Redirecting to your map...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0c1324] text-white flex items-center justify-center pt-20 pb-12 px-4 relative overflow-hidden">
      {/* Background glows */}
      <div className="absolute top-1/4 -left-20 w-96 h-96 bg-indigo-600 opacity-5 blur-[120px] rounded-full" />
      <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-orange-500 opacity-5 blur-[120px] rounded-full" />

      <div className="w-full max-w-2xl relative">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center space-y-4">
            <h1 className="font-headline text-4xl md:text-5xl font-extrabold tracking-tight">
              Get Your Local Number
            </h1>
            <p className="text-slate-400 text-lg max-w-lg mx-auto leading-relaxed">
              Choose a local number so property owners see a familiar area code when you call
            </p>
          </div>

          {/* Setup Card */}
          <div className="backdrop-blur-xl bg-[#23293c]/40 border border-slate-700/20 rounded-xl p-8 md:p-12 shadow-2xl">
            {/* Search Form */}
            <div className="space-y-6 mb-8">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-widest text-indigo-400/80 font-semibold">Search by Area Code</label>
                <div className="flex flex-col md:flex-row gap-4">
                  <div className="relative flex-grow">
                    <MaterialIcon icon="location_on" className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={areaCode}
                      onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                      maxLength={3}
                      className="w-full bg-[#070d1f] border-none focus:ring-2 focus:ring-indigo-500/40 text-white rounded-lg py-4 pl-12 pr-4 text-lg"
                      placeholder="559"
                    />
                  </div>
                  <button
                    onClick={searchNumbers}
                    disabled={searching || areaCode.length < 3}
                    className="bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold px-8 py-4 rounded-lg hover:scale-[0.98] transition-transform whitespace-nowrap disabled:opacity-50"
                  >
                    {searching ? 'Searching...' : 'Search Available Numbers'}
                  </button>
                </div>
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-sm bg-red-900/20 rounded-lg px-4 py-2 mb-6">{error}</p>
            )}

            {/* Results */}
            {numbers.length > 0 && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-headline text-xl font-bold">Available Numbers</h3>
                  <span className="text-xs text-slate-500">Showing {numbers.length} results for {areaCode}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {numbers.map((n) => (
                    <label
                      key={n.phoneNumber}
                      className={`group relative flex items-center justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                        selected === n.phoneNumber
                          ? 'bg-indigo-600/10 border-indigo-500/50'
                          : 'bg-[#151b2d] border-transparent hover:border-indigo-500/30'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="phone_number"
                          value={n.phoneNumber}
                          checked={selected === n.phoneNumber}
                          onChange={() => setSelected(n.phoneNumber)}
                          className="w-5 h-5 text-indigo-600 bg-[#070d1f] border-slate-600 focus:ring-indigo-500"
                        />
                        <span className="font-headline font-semibold text-white group-hover:text-indigo-400 transition-colors">
                          {formatPhone(n.phoneNumber)}
                        </span>
                      </div>
                      {n.locality && (
                        <span className="text-[10px] px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-full uppercase">
                          {n.locality}, {n.region}
                        </span>
                      )}
                    </label>
                  ))}
                </div>

                {/* Actions */}
                <div className="pt-8 flex flex-col gap-4">
                  <button
                    onClick={claimNumber}
                    disabled={!selected || provisioning}
                    className="w-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white font-bold py-5 rounded-lg text-lg shadow-xl shadow-indigo-600/20 hover:scale-[0.99] transition-transform disabled:opacity-50"
                  >
                    {provisioning ? 'Provisioning...' : 'Claim This Number'}
                  </button>
                  <button
                    onClick={() => router.push('/map')}
                    className="w-full bg-[#23293c] text-slate-400 font-medium py-4 rounded-lg hover:bg-[#2e3447] transition-colors"
                  >
                    I&apos;ll use my own phone for now
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Footer badges */}
          <div className="flex items-center justify-center gap-8 text-slate-600">
            <div className="flex items-center gap-2">
              <MaterialIcon icon="shield" className="text-[16px]" />
              <span className="text-xs">Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <MaterialIcon icon="verified" className="text-[16px]" />
              <span className="text-xs">Carrier Verified</span>
            </div>
            <div className="flex items-center gap-2">
              <MaterialIcon icon="public" className="text-[16px]" />
              <span className="text-xs">VoIP Ready</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
