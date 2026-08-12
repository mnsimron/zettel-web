'use client';

import { useState, useEffect } from 'react';
import { ArrowRight, Lock, Mail, Sparkles } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/');
      }
    };

    checkSession();
  }, [router]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (signUpError) {
          throw signUpError;
        }

        if (data.user) {
          // Create profile entry for the new user
          const { error: profileError } = await supabase
            .from('profiles')
            .insert([
              {
                id: data.user.id,
                email: data.user.email || email,
                full_name: fullName || null,
              },
            ]);

          if (profileError && !profileError.message.includes('duplicate')) {
            throw profileError;
          }
        }

        if (data.user && !data.session) {
          setMessage('Check your inbox to confirm your email before signing in.');
          return;
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (signInError) {
          throw signInError;
        }
      }

      router.replace('/');
    } catch (err) {
      const nextError = err instanceof Error ? err.message : 'Authentication failed.';
      setError(nextError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-black-600 to-indigo-900 px-4 py-12 text-white">
      <div className="w-full max-w-md rounded-2xl border border-indigo-400/30 bg-white/10 p-8 shadow-2xl backdrop-blur-xl dark:bg-white/5">
        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white shadow-sm">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/70">
              Zettel
            </p>
            <h1 className="text-lg font-semibold text-white">
              {mode === 'login' ? 'Welcome back' : 'Create your account'}
            </h1>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {mode === 'signup' && (
            <div>
              <label htmlFor="fullName" className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/80">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                placeholder="Jane Doe"
                className="w-full rounded-lg border border-white/20 bg-white px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-white focus:ring-2 focus:ring-white/50"
              />
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/80">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="w-full rounded-lg border border-white/20 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-white focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-medium uppercase tracking-[0.12em] text-white/80">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full rounded-lg border border-white/20 bg-white py-2.5 pl-10 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-white focus:ring-2 focus:ring-white/50"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-red-300/50 bg-red-500/20 px-3 py-2 text-xs text-white backdrop-blur-sm">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-emerald-300/50 bg-emerald-500/20 px-3 py-2 text-xs text-white backdrop-blur-sm">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-indigo-700 transition hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-6 border-t border-white/20 pt-4 text-center text-sm text-white/70">
          {mode === 'login' ? 'Need an account?' : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
              setMessage(null);
            }}
            className="font-medium text-white hover:text-white/90 transition"
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </div>
      </div>
    </main>
  );
}
