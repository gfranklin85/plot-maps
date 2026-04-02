// Run migration to create call_scripts + call_responses tables
// Usage: node scripts/run-migration.mjs

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bjbwxjsiqtvkyllyfhrr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is'
);

// Use supabase.rpc to run raw SQL via a postgres function
// Since we can't run raw SQL via REST, we'll test if tables exist and create via the dashboard
// Instead, let's just seed the default call scripts data after tables are created

// For now, try inserting — if it fails, the user needs to run the SQL in Supabase Dashboard
async function main() {
  console.log('Testing call_scripts table...');

  const { data, error } = await supabase.from('call_scripts').select('id').limit(1);

  if (error && error.code === 'PGRST205') {
    console.log('\n❌ call_scripts table does not exist yet.');
    console.log('\nPlease run this SQL in Supabase Dashboard > SQL Editor:\n');
    console.log(`
CREATE TABLE IF NOT EXISTS call_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE call_scripts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for call_scripts" ON call_scripts FOR ALL USING (true) WITH CHECK (true);

CREATE TABLE IF NOT EXISTS call_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id uuid REFERENCES leads(id) ON DELETE CASCADE,
  script_id uuid REFERENCES call_scripts(id) ON DELETE SET NULL,
  question text NOT NULL,
  answer text,
  call_date timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE call_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for call_responses" ON call_responses FOR ALL USING (true) WITH CHECK (true);
`);
    console.log('After running the SQL, re-run this script to seed default questions.\n');
    return;
  }

  console.log('✅ call_scripts table exists. Seeding default questions...');

  // Seed default call scripts
  const defaultScripts = [
    {
      category: 'residential',
      questions: JSON.stringify([
        { question: 'Are you considering buying again?', order: 1 },
        { question: 'Would you relocate if the price was right?', order: 2 },
        { question: 'Do you have any plans to sell?', order: 3 },
        { question: 'What do you want most right now?', order: 4 },
      ]),
    },
    {
      category: 'commercial_occupied',
      questions: JSON.stringify([
        { question: 'What are the current lease terms?', order: 1 },
        { question: 'What cap rate are you expecting?', order: 2 },
        { question: 'Any plans to sell or refinance?', order: 3 },
        { question: 'What do you want most right now?', order: 4 },
      ]),
    },
    {
      category: 'commercial_vacant',
      questions: JSON.stringify([
        { question: 'What are your plans for this property?', order: 1 },
        { question: 'Do you have an asking price in mind?', order: 2 },
        { question: 'How long has it been vacant?', order: 3 },
        { question: 'What do you want most right now?', order: 4 },
      ]),
    },
    {
      category: 'general',
      questions: JSON.stringify([
        { question: 'What do you want most right now?', order: 1 },
        { question: 'Is there anything I can help you with today?', order: 2 },
      ]),
    },
  ];

  // Check if already seeded
  const { data: existing } = await supabase.from('call_scripts').select('id');
  if (existing && existing.length > 0) {
    console.log(`Already have ${existing.length} scripts. Skipping seed.`);
    return;
  }

  const { error: insertError } = await supabase.from('call_scripts').insert(defaultScripts);
  if (insertError) {
    console.error('Error seeding:', insertError);
  } else {
    console.log(`✅ Seeded ${defaultScripts.length} default call scripts.`);
  }
}

main().catch(console.error);
