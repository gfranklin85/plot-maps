import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bjbwxjsiqtvkyllyfhrr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is'
);

async function checkLeadsWithoutUserId() {
  try {
    console.log('Checking leads table for records without user_id...');

    // Query for leads where user_id is null
    const { data, error } = await supabase
      .from('leads')
      .select('id, name, email, phone, created_at')
      .is('user_id', null);

    if (error) {
      console.error('Error querying leads:', error);
      return;
    }

    console.log(`Found ${data.length} leads without user_id:`);

    if (data.length > 0) {
      console.table(data);
    } else {
      console.log('No leads found without user_id. Safe to apply RLS policies.');
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkLeadsWithoutUserId();