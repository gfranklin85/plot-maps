import { redirect } from 'next/navigation';

// /forms is RETIRED — everything lives under /documents now (the client's
// review-and-sign hub). Any stray link/bookmark lands there.
export default function FormsRedirect() {
  redirect('/documents');
}
