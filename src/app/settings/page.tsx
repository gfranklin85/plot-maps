'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useProfile, type UserProfile } from '@/lib/profile-context';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import MaterialIcon from '@/components/ui/MaterialIcon';

interface ScriptQuestion { question: string; order: number }
interface CallScript { id: string; category: string; questions: ScriptQuestion[] }

export default function SettingsPage() {
  const { profile, initials, updateProfile } = useProfile();
  const [saved, setSaved] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [mapCenterAddress, setMapCenterAddress] = useState('');
  const [geocodeResult, setGeocodeResult] = useState<{ total: number; geocoded: number } | null>(null);
  const [prospectingFocus, setProspectingFocus] = useState('residential');

  // Local form state
  const [form, setForm] = useState<UserProfile>({ ...profile });

  // Call Scripts
  const [callScripts, setCallScripts] = useState<CallScript[]>([]);
  const [editingScript, setEditingScript] = useState<string | null>(null);
  const [newQuestions, setNewQuestions] = useState<Record<string, string>>({});

  const fetchScripts = useCallback(async () => {
    const res = await fetch('/api/call-scripts');
    if (res.ok) setCallScripts(await res.json());
  }, []);

  useEffect(() => { fetchScripts(); }, [fetchScripts]);

  async function addQuestion(scriptId: string) {
    const text = (newQuestions[scriptId] || '').trim();
    if (!text) return;
    const script = callScripts.find(s => s.id === scriptId);
    if (!script) return;
    const questions = [...script.questions, { question: text, order: script.questions.length + 1 }];
    await fetch('/api/call-scripts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: scriptId, questions }) });
    setNewQuestions((prev) => ({ ...prev, [scriptId]: '' }));
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

  const { user, signOut } = useAuth();

  async function handleReGeocode() {
    setGeocoding(true);
    setGeocodeResult(null);

    if (!user) {
      setGeocodeResult({ total: 0, geocoded: 0 });
      setGeocoding(false);
      return;
    }

    try {
      // Fetch leads with missing coordinates for the current user only
      const { data: leads } = await supabase
        .from('leads')
        .select('id, property_address, city, state, zip')
        .eq('user_id', user.id)
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

            for (let j = 0; j < Math.min(geoArr.length, chunk.length); j++) {
              const geo = geoArr[j];
              const lead = chunk[j];

              if (geo.lat && geo.lng && geo.address) {
                await supabase
                  .from('leads')
                  .update({
                    latitude: geo.lat,
                    longitude: geo.lng,
                    geocoded_at: new Date().toISOString(),
                  })
                  .eq('id', lead.id)
                  .eq('user_id', user.id);
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
        <h1 className="text-2xl font-bold text-on-surface font-headline">Settings</h1>
        <p className="text-sm text-secondary mt-1">Manage your profile and preferences</p>
      </div>

      {/* Profile Section */}
      <section className="glass-card rounded-2xl p-6 space-y-6">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="person" className="text-primary" />
          <h2 className="text-lg font-bold text-on-surface font-headline">Profile</h2>
        </div>

        <div className="flex items-center gap-6 mb-6">
          <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-white text-xl font-bold shrink-0">
            {initials}
          </div>
          <div className="text-sm text-secondary">
            Your initials are auto-generated from your name.
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Full Name</label>
            <input
              type="text"
              value={form.fullName}
              onChange={(e) => handleChange('fullName', e.target.value)}
              placeholder="Your full name"
              className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Title / Role</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="e.g. Senior Agent"
              className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Email</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => handleChange('email', e.target.value)}
              placeholder="you@example.com"
              className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-on-surface mb-1">Phone</label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => handleChange('phone', e.target.value)}
              placeholder="(555) 123-4567"
              className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-on-surface mb-1">Company</label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => handleChange('company', e.target.value)}
              placeholder="Your brokerage or company name"
              className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>
      </section>

      {/* Billing & Subscription */}
      <BillingSection />

      {/* Map Preferences */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="map" className="text-primary" />
          <h2 className="text-lg font-bold text-on-surface font-headline">Map Preferences</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Default Map Type</label>
          <div className="flex gap-3">
            {(['roadmap', 'satellite', 'hybrid'] as const).map((type) => (
              <button
                key={type}
                onClick={() => setForm((prev) => ({ ...prev, defaultMapType: type }))}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                  form.defaultMapType === type
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Default Market Area</label>
          <p className="text-xs text-secondary mb-2">
            Set your primary prospecting area. The map will center here when you open it.
          </p>
          <MapCenterAutocomplete
            onPlaceSelected={(lat, lng, address) => {
              setForm((prev) => ({ ...prev, defaultMapCenter: { lat, lng } }));
              setMapCenterAddress(address);
            }}
            currentCenter={form.defaultMapCenter}
          />
          {form.defaultMapCenter && (
            <div className="flex items-center gap-2 mt-2">
              <span className="text-xs text-secondary">
                Current: {mapCenterAddress || `${form.defaultMapCenter.lat.toFixed(4)}, ${form.defaultMapCenter.lng.toFixed(4)}`}
              </span>
              <button
                onClick={() => { setForm((prev) => ({ ...prev, defaultMapCenter: null })); setMapCenterAddress(''); }}
                className="text-xs text-red-500 hover:text-red-700"
              >
                Reset to default
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-on-surface mb-2">Prospecting Focus</label>
          <select
            value={prospectingFocus}
            onChange={(e) => setProspectingFocus(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="residential">Residential</option>
            <option value="multifamily">Multifamily</option>
            <option value="land">Vacant Land</option>
            <option value="commercial">Commercial</option>
            <option value="mixed">Mixed Use</option>
          </select>
          <p className="text-xs text-secondary mt-1">This helps tailor scripts and suggestions to your focus.</p>
        </div>
      </section>

      {/* Opening Script */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="record_voice_over" className="text-primary" />
          <h2 className="text-lg font-bold text-on-surface font-headline">Opening Script</h2>
        </div>
        <p className="text-xs text-secondary">
          This script appears on map popups and lead pages. Use placeholders: <code className="bg-surface-container px-1 rounded">{'{name}'}</code> for owner name, <code className="bg-surface-container px-1 rounded">{'{street}'}</code> for street address, <code className="bg-surface-container px-1 rounded">{'{value}'}</code> for estimated value.
        </p>
        <textarea
          value={form.openingScript}
          onChange={(e) => setForm((prev) => ({ ...prev, openingScript: e.target.value }))}
          rows={10}
          className="w-full px-4 py-3 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono leading-relaxed"
        />
      </section>

      {/* Usage */}
      <UsageMeter />

      {/* Phone Number */}
      <PhoneNumberSection />

      {/* Notifications */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="notifications" className="text-primary" />
          <h2 className="text-lg font-bold text-on-surface font-headline">Notifications <span className="text-sm font-normal text-secondary">(Coming soon)</span></h2>
        </div>

        <p className="text-xs text-secondary italic">Notifications are not yet active.</p>

        <div className="opacity-50 pointer-events-none">
          {([
            { key: 'email' as const, label: 'Email Notifications', desc: 'Receive updates and alerts via email' },
            { key: 'push' as const, label: 'Push Notifications', desc: 'Browser push notifications for new activity' },
            { key: 'sms' as const, label: 'SMS Alerts', desc: 'Text message alerts for urgent items' },
          ]).map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-on-surface">{label}</p>
                <p className="text-xs text-secondary">{desc}</p>
              </div>
              <button
                onClick={() => {}}
                className={`relative w-11 h-6 rounded-full transition-colors ${
                  form.notifications[key] ? 'bg-primary' : 'bg-outline-variant'
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
        </div>
      </section>

      {/* Call Scripts */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="checklist" className="text-primary" />
          <h2 className="text-lg font-bold text-on-surface font-headline">Call Scripts</h2>
        </div>
        <p className="text-xs text-secondary">
          Configure the questions shown on each lead&apos;s detail page during calls. Questions are grouped by property type.
        </p>

        {callScripts.map((script) => (
          <div key={script.id} className="border border-card-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-on-surface capitalize">
                {script.category.replace('_', ' ')}
              </h3>
              <button
                onClick={() => setEditingScript(editingScript === script.id ? null : script.id)}
                className="text-xs text-primary hover:underline"
              >
                {editingScript === script.id ? 'Done' : 'Edit'}
              </button>
            </div>

            <div className="space-y-2">
              {(script.questions as ScriptQuestion[])
                .sort((a, b) => a.order - b.order)
                .map((q, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className="text-xs text-on-surface-variant w-5">{idx + 1}.</span>
                    <span className="text-sm text-on-surface flex-1">{q.question}</span>
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
                  value={newQuestions[script.id] || ''}
                  onChange={(e) => setNewQuestions((prev) => ({ ...prev, [script.id]: e.target.value }))}
                  placeholder="Add a question..."
                  onKeyDown={(e) => e.key === 'Enter' && addQuestion(script.id)}
                  className="flex-1 px-3 py-1.5 rounded-lg bg-input-bg border border-card-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={() => addQuestion(script.id)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/90"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}

        {callScripts.length === 0 && (
          <p className="text-sm text-secondary italic">
            No call scripts configured yet. They will be created when the database tables are set up.
          </p>
        )}
      </section>

      {/* Data Management */}
      <section className="glass-card rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <MaterialIcon icon="database" className="text-primary" />
          <h2 className="text-lg font-bold text-on-surface font-headline">Data Management</h2>
        </div>

        <div className="flex items-center justify-between py-2">
          <div>
            <p className="text-sm font-medium text-on-surface">Re-geocode Missing Leads</p>
            <p className="text-xs text-secondary">
              Find leads without map coordinates and geocode their addresses
            </p>
          </div>
          <button
            onClick={handleReGeocode}
            disabled={geocoding}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-surface-container text-on-surface hover:bg-surface-container-high transition-colors disabled:opacity-50"
          >
            {geocoding ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-on-surface-variant border-t-transparent rounded-full animate-spin" />
                Processing...
              </span>
            ) : (
              'Run Geocode'
            )}
          </button>
        </div>

        {geocodeResult && (
          <div className="text-sm px-4 py-3 rounded-xl bg-primary/10 text-primary">
            {geocodeResult.total === 0
              ? 'All leads already have coordinates.'
              : `Found ${geocodeResult.total} leads without coordinates. Successfully geocoded ${geocodeResult.geocoded}.`}
          </div>
        )}
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

      {/* Sign Out */}
      <section className="glass-card rounded-2xl p-6">
        <button
          onClick={signOut}
          className="flex items-center gap-2 text-red-400 hover:text-red-300 font-semibold transition-colors"
        >
          <MaterialIcon icon="logout" className="text-[20px]" />
          Sign Out
        </button>
      </section>
      <p className="text-xs text-secondary -mt-4">Saves profile, map preferences, and script. Call scripts save automatically when edited.</p>
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
        <MaterialIcon icon="phone_in_talk" className="text-primary" />
        <h2 className="text-lg font-bold text-on-surface font-headline">Phone Number</h2>
      </div>

      {twilioNumber ? (
        <div className="flex items-center justify-between py-3">
          <div>
            <p className="text-sm font-medium text-on-surface">Your calling number</p>
            <p className="text-2xl font-bold text-emerald-600 font-mono mt-1">{formatPhone(twilioNumber)}</p>
            <p className="text-xs text-secondary mt-1">This number shows as your caller ID when you call from the app</p>
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
          <p className="text-sm text-secondary mb-4">
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
                  className="flex-1 px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <button
                  onClick={searchNumbers}
                  disabled={searching || areaCode.length < 3}
                  className="px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold disabled:opacity-50"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              {availableNumbers.length > 0 && (
                <>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {availableNumbers.map((n) => (
                      <label
                        key={n.phoneNumber}
                        className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-colors ${
                          selected === n.phoneNumber ? 'bg-primary/10 border border-primary/30' : 'bg-input-bg border border-card-border hover:bg-surface-container'
                        }`}
                      >
                        <input
                          type="radio"
                          name="number"
                          value={n.phoneNumber}
                          checked={selected === n.phoneNumber}
                          onChange={() => setSelected(n.phoneNumber)}
                          className="w-4 h-4 text-primary"
                        />
                        <span className="font-mono font-bold text-sm">{formatPhone(n.phoneNumber)}</span>
                        {n.locality && <span className="text-xs text-on-surface-variant">{n.locality}, {n.region}</span>}
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={claimNumber}
                    disabled={!selected || provisioning}
                    className="w-full rounded-xl action-gradient text-white py-3 font-bold text-sm disabled:opacity-50 mt-3"
                  >
                    {provisioning ? 'Provisioning...' : 'Claim This Number'}
                  </button>
                </>
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
        <MaterialIcon icon="speed" className="text-primary" />
        <h2 className="text-lg font-bold text-on-surface font-headline">Usage This Month</h2>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium text-on-surface">Geocodes</span>
          <span className={`text-sm font-bold ${isNearLimit ? 'text-amber-600' : 'text-on-surface-variant'}`}>
            {usage.geocodes_used} / {usage.geocodes_limit}
          </span>
        </div>
        <div className="h-3 w-full bg-outline-variant rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              isNearLimit ? 'bg-amber-500' : 'bg-blue-500'
            }`}
            style={{ width: `${Math.min(100, percent)}%` }}
          />
        </div>
        <p className="text-xs text-secondary mt-1">
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

/* ── Billing & Subscription ── */
function BillingSection() {
  const { profile } = useProfile();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const status = profile.subscriptionStatus || '';
  const isSubscribed = status === 'active';

  const statusConfig: Record<string, { label: string; color: string }> = {
    active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700' },
    past_due: { label: 'Past Due', color: 'bg-amber-50 text-amber-700' },
    canceled: { label: 'Canceled', color: 'bg-red-50 text-red-700' },
  };

  const { label: statusLabel, color: statusColor } = statusConfig[status] || {
    label: 'Free',
    color: 'bg-surface-container text-on-surface-variant',
  };

  async function handleManageBilling() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.url) window.location.href = data.url;
    } catch {
      setError('No billing account found. Subscribe to a plan first.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="glass-card rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <MaterialIcon icon="credit_card" className="text-primary" />
        <h2 className="text-lg font-bold text-on-surface font-headline">Billing & Subscription</h2>
      </div>

      <div className="flex items-center gap-4">
        <div>
          <p className="text-sm text-secondary">Current Plan</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-lg font-bold text-on-surface">
              {isSubscribed ? 'Subscribed' : 'Free'}
            </span>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
          {!isSubscribed && (
            <p className="text-xs text-on-surface-variant mt-1">50 free geocodes included</p>
          )}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600">{error}</p>
      )}

      <div className="flex gap-3">
        {isSubscribed && (
          <button
            onClick={handleManageBilling}
            disabled={loading}
            className="flex items-center gap-2 action-gradient text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition-shadow disabled:opacity-50"
          >
            <MaterialIcon icon="open_in_new" className="text-[16px]" />
            {loading ? 'Loading...' : 'Manage Billing'}
          </button>
        )}
        {!isSubscribed && (
          <a
            href="/subscribe"
            className="flex items-center gap-2 action-gradient text-white px-6 py-2.5 rounded-xl font-bold text-sm hover:shadow-lg transition-shadow"
          >
            <MaterialIcon icon="upgrade" className="text-[16px]" />
            Upgrade Plan
          </a>
        )}
      </div>
    </section>
  );
}

/* ── Map Center Autocomplete ── */
function MapCenterAutocomplete({ onPlaceSelected, currentCenter }: {
  onPlaceSelected: (lat: number, lng: number, address: string) => void;
  currentCenter: { lat: number; lng: number } | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    if (!inputRef.current || autocompleteRef.current) return;
    if (typeof google === 'undefined' || !google?.maps?.places) {
      // Load Google Maps API with Places
      const existing = document.querySelector('script[src*="maps.googleapis.com"]');
      if (!existing) {
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places`;
        script.async = true;
        script.onload = () => setRetries(r => r + 1);
        document.head.appendChild(script);
      } else if (retries < 20) {
        const timer = setTimeout(() => setRetries(r => r + 1), 500);
        return () => clearTimeout(timer);
      }
      return;
    }

    const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
      types: ['geocode'],
      componentRestrictions: { country: 'us' },
      fields: ['geometry', 'formatted_address'],
    });

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (place.geometry?.location) {
        onPlaceSelected(
          place.geometry.location.lat(),
          place.geometry.location.lng(),
          place.formatted_address || ''
        );
        if (inputRef.current) inputRef.current.value = place.formatted_address || '';
      }
    });

    autocompleteRef.current = autocomplete;
  }, [retries, onPlaceSelected]);

  return (
    <input
      ref={inputRef}
      type="text"
      placeholder={currentCenter ? 'Update location...' : 'e.g. Hanford, CA or 523 Puffin Ln'}
      className="w-full px-4 py-2.5 rounded-xl bg-input-bg border border-card-border text-sm text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
    />
  );
}
