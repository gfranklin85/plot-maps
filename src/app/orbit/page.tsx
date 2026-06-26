// /orbit — folded into the landing page. The Orbit tool now lives ON the front
// page (OrbitSection), not a lonely standalone page. This route redirects to
// the landing section so any existing links keep working.
// memory/project_orbit_property_agent_magnet.

import { redirect } from 'next/navigation';

export default function OrbitRedirect() {
  redirect('/#orbit');
}
