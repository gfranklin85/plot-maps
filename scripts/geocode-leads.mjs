/**
 * Geocode all leads that are missing lat/lng coordinates.
 * Usage: node scripts/geocode-leads.mjs
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bjbwxjsiqtvkyllyfhrr.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is';
const GOOGLE_API_KEY = 'AIzaSyDPQhfHosE7BH9NnyB24TcJtTcYIqPYsHA';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function geocodeAddress(address) {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.status === 'OK' && data.results?.length) {
    return {
      lat: data.results[0].geometry.location.lat,
      lng: data.results[0].geometry.location.lng,
    };
  }
  if (data.status !== 'OK') {
    console.log(`    ⚠ ${data.status}: ${address}`);
  }
  return null;
}

async function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  console.log('Fetching leads without coordinates...');

  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, property_address')
    .is('latitude', null)
    .not('property_address', 'is', null);

  if (error) {
    console.error('Error fetching leads:', error.message);
    return;
  }

  console.log(`Found ${leads.length} leads to geocode.`);
  console.log(`Estimated cost: $${(leads.length * 0.005).toFixed(2)}\n`);

  let geocoded = 0;
  let failed = 0;

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i];
    const coords = await geocodeAddress(lead.property_address);

    if (coords) {
      const { error: updateErr } = await supabase
        .from('leads')
        .update({
          latitude: coords.lat,
          longitude: coords.lng,
          geocoded_at: new Date().toISOString(),
        })
        .eq('id', lead.id);

      if (updateErr) {
        console.log(`    ✗ Update failed for ${lead.id}: ${updateErr.message}`);
        failed++;
      } else {
        geocoded++;
      }
    } else {
      failed++;
    }

    // Rate limit: 50ms between requests
    await delay(50);

    if ((i + 1) % 50 === 0 || i === leads.length - 1) {
      console.log(`  Progress: ${i + 1}/${leads.length} (${geocoded} geocoded, ${failed} failed)`);
    }
  }

  console.log(`\n✅ Done! Geocoded ${geocoded}/${leads.length} leads. ${failed} failed.`);
}

main().catch(console.error);
