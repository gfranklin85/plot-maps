'use client';

import { useState, useEffect, useCallback } from 'react';
import { useProfile, type UserProfile } from '@/lib/profile-context';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface ScriptQuestion { question: string; order: number }
interface CallScript { id: string; category: string; questions: ScriptQuestion[] }

export default function SettingsPage() {
  const { profile, initials, updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeResult, setGeocodeResult] = useState<{ total: number; geocoded: number } | null>(null);

  // Local form state
  const [form, setForm] = useState<UserProfile>({ ...profile });

  // Call Scripts
  const [callScripts, setCallScripts] = useState<CallScript[]>([]);
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [newQuestion, setNewQuestion] = useState('');

  const fetchScripts = useCallback(async () => {
    const res = await fetch('/api/call-scripts');
    if (res.ok) setCallScripts(await res.json());
  }, []);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  async function addQuestion(scriptId: string) {
    if (!newQuestion.trim()) return;
    const script = callScripts.find(s => s.id === scriptId);
    if (!script) return;
    const questions = [...script.questions, { question: newQuestion.trim(), order: script.questions.length + 1 }];
    await fetch('/api/call-scripts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: scriptId, questions }) });
    setNewQuestion('');
    fetchScripts();
  }

  async function removeQuestion(scriptId: string, idx: number) {
    const script = callScripts.find(s => s.id === scriptId);
    if (!script) return;
    const questions = script.questions.filter((_, i) => i !== idx).map((q, i) => ({ ...q, order: i + 1 }));
    await fetch('/api/call-scripts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: scriptId, questions }) });
    fetchScripts();
  }

  function handleChange(field: keyof UserProfile, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSave() {
    updateProfile(form);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleNotificationToggle(key: keyof UserProfile['notifications']) {
    setForm((prev) => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: !prev.notifications[key] },
    }));
  }

  async function handleReGeocode() {
    setGeocoding(true);
    setGeocodeResult(null);

    try {
      // Fetch leads with missing coordinates
      const { data: leads } = await supabase
        .from('leads')
        .select('id, property_address, city, state, zip')
        .is('latitude', null)
        .not('property_address', 'is', null);

      if (!leads || leads.length === 0) {
        setGeocodeResult({ total: 0, geocoded: 0 });
        setGeocoding(false);
        return;
      }

      let geocoded = 0;
      const chunkSize = 25;

      for (let i = 0; i < leads.length; i += chunkSize) {
        const chunk = leads.slice(i, i + chunkSize);
        const addresses = chunk.map((l) =>
          [l.property_address, l.city, l.state, l.zip].filter(Boolean).join(', ')
        );

        try {
          const res = await fetch('/api/geocode', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ addresses }),
          });

          if (res.ok) {
            const data = await res.json();
            const geoArr = Array.isArray(data) ? data : data.results ?? [];

            for (const geo of geoArr) {
              if (geo.lat && geo.lng && geo.address) {
                await supabase
                  .from('leads')
                  .update({
                    latitude: geo.lat,
                    longitude: geo.lng,
                    geocoded_at: new Date().toISOString(),
                  })
                  .ilike('property_address', `%${geo.address.split(',')[0]}%`);
                geocoded++;
              }
            }
          }
        } catch {
          // non-fatal
        }
      }

      setGeocodeResult({ total: leads.length, geocoded });
    } catch {
      setGeocodeResult({ total: 0, geocoded: 0 });
    }

    setGeocoding(false);
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-headline">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your profile and preferences</p>
      </div>

      {/* Profile Section */}
      <section className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="person" className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 font-headline">Profile</h2>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-white text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="text-sm text-slate-500">
            Your initials are auto-generated from your name.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title / Role</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Senior Agent"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Your brokerage or company name"
              className="w-full px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
            />
          </div>
        </div>
      </section>

      {/* Map Preferences */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="map" className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 font-headline">Map Preferences</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Default Map Type</label>
          <div className="flex gap-3">
            {(['roadmap', 'satellite', 'hybrid'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setForm((prev) => ({ ...prev, defaultMapType: type }))}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  form.defaultMapType === type
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Opening Script */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="record_voice_over" className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 font-headline">Opening Script</h2>
        </div>
        <p className="text-xs text-slate-500">
          This script appears on map popups and lead pages. Use placeholders: <code className="bg-slate-100 px-1 rounded">{'{name}'}</code> for owner name, <code className="bg-slate-100 px-1 rounded">{'{street}'}</code> for street address, <code className="bg-slate-100 px-1 rounded">{'{value}'}</code> for estimated value.
        </p>
        <textarea
          value={form.openingScript}
          onChange={(e) => setForm((prev) => ({ ...prev, openingScript: e.target.value }))}
          rows={10}
          className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 font-mono leading-relaxed"
        />
      </section>

      {/* Usage */}
      <UsageMeter />

      {/* Phone Number */}
      <PhoneNumberSection />

      {/* Notifications */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="notifications" className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 font-headline">Notifications</h2>
        </div>

        {([
          { key: 'email' as const, label: 'Email Notifications', desc: 'Receive updates and alerts via email' },
          { key: 'push' as const, label: 'Push Notifications', desc: 'Browser push notifications for new activity' },
          { key: 'sms' as const, label: 'SMS Alerts', desc: 'Text message alerts for urgent items' },
        ]).map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-slate-800">{label}</p>
              <p className="text-xs text-slate-500">{desc}</p>
            </div>
            <button
              onClick={() => handleNotificationToggle(key)}
              className={`relative w-11 h-6 rounded-full transition-colors ${
                form.notifications[key] ? 'bg-blue-600' : 'bg-slate-300'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                  form.notifications[key] ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        ))}
      </section>

      {/* Call Scripts */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="checklist" className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 font-headline">Call Scripts</h2>
        </div>
        <p className="text-xs text-slate-500">
          Configure the questions shown on each lead&apos;s detail page during calls. Questions are grouped by property type.
        </p>

        {callScripts.map((script) => (
          <div key={script.id} className="border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-slate-800 capitalize">
                {script.category.replace('_', ' ')}
              </h3>
              <button
                onClick={() => setEditingScript(editingScript === script.id ? null : script.id)}
                className="text-xs text-blue-600 hover:underline"
              >
                {editingScript === script.id ? 'Done' : 'Edit'}
              </button>
            </div>

            <div className="space-y-2">
              {(script.questions as ScriptQuestion[])
                .sort((a, b) => a.order - b.order)
                .map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-slate-400 w-5">{idx + 1}.</span>
                    <span className="text-sm text-slate-700 flex-1">{q.question}</span>
                    {editingScript === script.id && (
                      <button
                        onClick={() => removeQuestion(script.id, idx)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        <MaterialIcon icon="close" className="text-[16px]" />
                      </button>
                    )}
                  </div>
                ))}
            </div>

            {editingScript === script.id && (
              <div className="flex gap-2 mt-3">
                <input
                  type="text"
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Add a question..."
                  onKeyDown={(e) => e.key === 'Enter' && addQuestion(script.id)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  onClick={() => addQuestion(script.id)}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}

        {callScripts.length === 0 && (
          <p className="text-sm text-slate-500 italic">
            No call scripts configured yet. They will be created when the database tables are set up.
          </p>
        )}
      </section>

      {/* Data Management */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="database" className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 font-headline">Data Management</h2>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-slate-800">Re-geocode Missing Leads</p>
            <p className="text-xs text-slate-500">
              Find leads without map coordinates and geocode their addresses
            </p>
          </div>
          <button
            onClick={handleReGeocode}
            disabled={geocoding}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition-colors disabled:opacity-50"
          >
            {geocoding ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              'Run Geocode'
            )}
          </button>
        </div>

        {geocodeResult && (
          <div className="text-sm px-4 py-3 rounded-xl bg-blue-50 text-blue-800">
            {geocodeResult.total === 0
              ? 'All leads already have coordinates.'
              : `Found ${geocodeResult.total} leads without coordinates. Successfully geocoded ${geocodeResult.geocoded}.`}
          </div>
        )}
      </section>

      {/* Integrations */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="extension" className="text-blue-600" />
          <h2 className="text-lg font-bold text-slate-900 font-headline">Integrations</h2>
        </div>

        <div className="space-y-3">
          {[
            { name: 'Supabase', icon: 'cloud', status: 'Connected' },
            { name: 'Google Maps', icon: 'map', status: 'Connected' },
            { name: 'Twilio (Voice)', icon: 'call', status: 'Connected' },
            { name: 'Resend (Email)', icon: 'mail', status: 'Connected' },
            { name: 'Claude AI', icon: 'smart_toy', status: 'Connected' },
          ].map(({ name, icon, status }) => (
            <div key={name} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <MaterialIcon icon={icon} className="text-slate-500 text-[20px]" />
                <span className="text-sm font-medium text-slate-800">{name}</span>
              </div>
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                {status}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          className="action-gradient text-white px-8 py-3 rounded-xl font-bold shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30 transition-shadow"
        >
          Save Changes
        </button>
        {saved && (
          <span className="text-sm text-green-600 font-medium">Settings saved!</span>
        )}
      </div>
    </div>
  );
}

/* ── Phone Number Management Section ── */
function PhoneNumberSection() {
  const [twilioNumber, setTwilioNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [areaCode, setAreaCode] = useState('');
  const [searching, setSearching] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<{ phoneNumber: string; locality: string; region: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [provisioning, setProvisioning] = useState(false);
  const [error, setError] = useState('');
  const [showSearch, setShowSearch] = useState(false);

  useEffect(() => {
    async function fetchNumber() {
      const { data } = await supabase.from('profiles').select('twilio_phone_number').limit(1).single();
      setTwilioNumber(data?.twilio_phone_number || null);
      setLoading(false);
    }
    fetchNumber();
  }, []);

  async function searchNumbers() {
    if (areaCode.length < 3) return;
    setSearching(true);
    setError('');
    try {
      const res = await fetch(`/api/twilio/provision?areaCode=${areaCode}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAvailableNumbers(data.numbers || []);
      if (data.numbers?.length > 0) setSelected(data.numbers[0].phoneNumber);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
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
      setTwilioNumber(data.phoneNumber);
      setShowSearch(false);
      setAvailableNumbers([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Provisioning failed');
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

  if (loading) return null;

  return (
    <section className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <MaterialIcon icon="phone_in_talk" className="text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900 font-headline">Phone Number</h2>
      </div>

      {twilioNumber ? (
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">Your calling number</p>
            <p className="text-2xl font-bold text-emerald-600 font-mono mt-1">{formatPhone(twilioNumber)}</p>
            <p className="text-xs text-slate-500 mt-1">This number shows as your caller ID when you call from the app</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
              <span className="w-2 h-2 bg-emerald-500 rounded-full" />
              Active
            </span>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-slate-500 mb-4">
            Get a local phone number so property owners see a familiar area code when you call. Your number is used as caller ID for all outbound calls from the browser.
          </p>
          {!showSearch ? (
            <button
              onClick={() => setShowSearch(true)}
              className="flex items-center gap-2 rounded-xl action-gradient px-6 py-3 text-sm font-bold text-white hover:shadow-lg transition-shadow"
            >
              <MaterialIcon icon="add" className="text-[18px]" />
              Get a Number
            </button>
          ) : (
            <div className="space-y-4">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={areaCode}
                  onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, '').slice(0, 3))}
                  maxLength={3}
                  placeholder="Area code (e.g. 559)"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button
                  onClick={searchNumbers}
                  disabled={searching || areaCode.length < 3}
                  className="px-4 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              {availableNumbers.length > 0 && (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {availableNumbers.map((n) => (
                    <label
                      key={n.phoneNumber}
                      className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                        selected === n.phoneNumber ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <input
                        type="radio"
                        name="number"
                        value={n.phoneNumber}
                        checked={selected === n.phoneNumber}
                        onChange={() => setSelected(n.phoneNumber)}
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="font-mono font-bold text-sm">{formatPhone(n.phoneNumber)}</span>
                      {n.locality && <span className="text-xs text-slate-400">{n.locality}, {n.region}</span>}
                    </label>
                  ))}
                  <button
                    onClick={claimNumber}
                    disabled={!selected || provisioning}
                    className="w-full rounded-xl action-gradient text-white py-3 font-bold text-sm disabled:opacity-50"
                  >
                    {provisioning ? 'Provisioning...' : 'Claim This Number'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ── Usage Meter Section ── */
function UsageMeter() {
  const [usage, setUsage] = useState<{ geocodes_used: number; geocodes_limit: number; geocodes_remaining: number } | null>(null);

  useEffect(() => {
    fetch('/api/usage').then(r => r.json()).then(setUsage).catch(() => {});
  }, []);

  if (!usage) return null;

  const percent = usage.geocodes_limit > 0 ? Math.round((usage.geocodes_used / usage.geocodes_limit) * 100) : 0;
  const isNearLimit = percent > 80;

  return (
    <section className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <MaterialIcon icon="speed" className="text-blue-600" />
        <h2 className="text-lg font-bold text-slate-900 font-headline">Usage This Month</h2>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-slate-700">Geocodes</span>
          <span className={`text-sm font-bold ${isNearLimit ? 'text-amber-600' : 'text-slate-600'}`}>
            {usage.geocodes_used} / {usage.geocodes_limit}
          </span>
        </div>
        <div className="h-3 w-full bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {usage.geocodes_remaining} remaining · Resets monthly
        </p>
      </div>

      {isNearLimit && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-700">
            Running low on geocodes. Overage geocodes are $0.01 each, or upgrade for a higher limit.
          </p>
        </div>
      )}
    </section>
  );
}
