import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://bjbwxjsiqtvkyllyfhrr.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJqYnd4anNpcXR2a3lsbHlmaHJyIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDI0NDE2NSwiZXhwIjoyMDc5ODIwMTY1fQ.s5dE5MQBwbDjQT-EM7rMGIwBQZGpfpBBysdjR0Yc_is'
);

async function checkUsersAndProfiles() {
  try {
    console.log('Checking auth.users table...');

    // Query auth.users
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers();

    if (usersError) {
      console.error('Error querying auth.users:', usersError);
      return;
    }

    console.log(`Found ${users.users.length} users in auth.users:`);
    if (users.users.length > 0) {
      const userData = users.users.map(user => ({
        id: user.id,
        email: user.email,
        created_at: user.created_at,
        last_sign_in_at: user.last_sign_in_at,
        email_confirmed_at: user.email_confirmed_at
      }));
      console.table(userData);
    }

    console.log('\nChecking profiles table...');

    // Query profiles
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('*');

    if (profilesError) {
      console.error('Error querying profiles:', profilesError);
      return;
    }

    console.log(`Found ${profiles.length} profiles:`);
    if (profiles.length > 0) {
      console.table(profiles);
    }

  } catch (error) {
    console.error('Script error:', error);
  }
}

checkUsersAndProfiles();