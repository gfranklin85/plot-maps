'use client';

import Link from 'next/link';

export default function CookiesPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 px-6 py-20">
      <div className="mx-auto max-w-4xl rounded-3xl border border-slate-800 bg-slate-900/90 p-10 shadow-2xl">
        <h1 className="text-4xl font-bold text-white mb-4">Cookie Policy</h1>
        <p className="text-slate-400 leading-relaxed mb-6">
          Plot Maps uses cookies and similar technologies to improve your experience, keep you logged in, and analyze usage.
        </p>
        <p className="text-slate-400 leading-relaxed mb-4">
          You can manage cookie preferences through your browser. We do not use cookies for advertising.
        </p>
        <p className="text-slate-400 leading-relaxed mb-6">
          If you have questions, contact us at{' '}
          <a href="mailto:gregfranklin523@gmail.com" className="text-indigo-400 underline">gregfranklin523@gmail.com</a>.
        </p>
        <Link href="/" className="inline-block rounded-full bg-indigo-500 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-400 transition-colors">
          Back to landing
        </Link>
      </div>
    </div>
  );
}
