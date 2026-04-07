'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push('/');
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0c1324] relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 opacity-40" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(79,70,229,0.05) 1px, transparent 0)', backgroundSize: '40px 40px' }} />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600 rounded-full blur-[160px] opacity-10" />
      <div className="absolute -bottom-40 -right-40 w-[500px] h-[500px] bg-orange-600 rounded-full blur-[200px] opacity-10" />

      <main className="relative z-10 w-full max-w-[480px] px-6">
        {/* Brand */}
        <div className="flex flex-col items-center mb-10">
          <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-xl bg-[#23293c] border border-white/10 shadow-xl">
            <span className="material-symbols-outlined text-indigo-400 text-3xl" style={{ fontVariationSettings: "'FILL' 1" }}>explore</span>
          </div>
          <h1 className="font-headline text-3xl font-extrabold tracking-tighter text-slate-100">Plot Maps</h1>
          <p className="text-slate-400 font-medium mt-2">Visual Prospecting CRM</p>
        </div>

        {/* Login Card */}
        <div className="backdrop-blur-xl bg-[#151b2d]/40 border border-white/5 rounded-2xl p-8 md:p-10 shadow-2xl">
          <div className="space-y-6">
            <div>
              <h2 className="font-headline text-xl font-bold text-slate-100">Welcome back</h2>
              <p className="text-slate-400 text-sm mt-1">Enter your credentials to continue</p>
            </div>

            {/* Google Login */}
            <button
              type="button"
              onClick={async () => {
                await supabase.auth.signInWithOAuth({
                  provider: 'google',
                  options: { redirectTo: `${window.location.origin}/auth/callback` },
                });
              }}
              className="w-full flex items-center justify-center gap-3 bg-[#2e3447] hover:bg-[#33394c] transition-all py-3.5 rounded-lg border border-white/10"
            >
              <svg width="18" height="18" viewBox="0 0 18 18"><path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/><path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/><path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/><path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/></svg>
              <span className="font-semibold text-sm text-slate-200">Continue with Google</span>
            </button>

            {/* Divider */}
            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-white/5" />
              <span className="flex-shrink mx-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">Or continue with email</span>
              <div className="flex-grow border-t border-white/5" />
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400 ml-1" htmlFor="login-email">Email Address</label>
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-[#070d1f]/60 border-0 focus:ring-2 focus:ring-indigo-500/40 rounded-lg py-3.5 px-4 text-sm text-slate-100 placeholder:text-slate-600 transition-all"
                  placeholder="name@company.com"
                />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center px-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-400" htmlFor="login-password">Password</label>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!email) { setError('Enter your email first'); return; }
                      const { error } = await supabase.auth.resetPasswordForEmail(email, {
                        redirectTo: `${window.location.origin}/auth/callback?next=/settings`,
                      });
                      if (error) setError(error.message);
                      else { setError(''); alert('If that email exists, a password reset link has been sent.'); }
                    }}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="login-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-[#070d1f]/60 border-0 focus:ring-2 focus:ring-indigo-500/40 rounded-lg py-3.5 px-4 text-sm text-slate-100 placeholder:text-slate-600 transition-all"
                  placeholder="••••••••"
                />
              </div>

              {error && (
                <div className="flex items-start gap-3 bg-red-900/20 border border-red-500/20 p-3 rounded-lg">
                  <span className="material-symbols-outlined text-red-400 text-[20px]">error_outline</span>
                  <p className="text-xs text-red-300 font-medium leading-tight">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-br from-indigo-400 to-indigo-600 hover:opacity-90 active:scale-[0.98] transition-all py-4 rounded-lg shadow-[0_8px_30px_rgb(79,70,229,0.3)] flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <span className="font-headline font-bold text-white text-sm tracking-tight">
                  {loading ? 'Signing in...' : 'Sign In to Dashboard'}
                </span>
                {!loading && <span className="material-symbols-outlined text-[18px] text-white">arrow_forward</span>}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/5 text-center">
            <p className="text-sm text-slate-400">
              New to Plot Maps?{' '}
              <Link href="/signup" className="text-indigo-400 font-bold hover:underline underline-offset-4 ml-1">
                Sign up free
              </Link>
            </p>
          </div>
        </div>

        {/* Security badges */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <div className="flex items-center gap-6 opacity-40">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-slate-400" style={{ fontVariationSettings: "'FILL' 1" }}>lock</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px] text-slate-400" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
              <span className="text-[10px] font-bold uppercase tracking-tighter text-slate-400">Secure</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
