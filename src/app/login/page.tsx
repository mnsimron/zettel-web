"use client";

import { useEffect, useState } from 'react';
import { ArrowRight, Loader2, Lock, Mail, Sparkles, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 fill-current">
      <path d="M12 .5a12 12 0 0 0-3.79 23.39c.6.11.82-.26.82-.58v-2.02c-3.34.73-4.04-1.6-4.04-1.6-.54-1.39-1.33-1.76-1.33-1.76-1.09-.74.08-.72.08-.72 1.2.08 1.83 1.23 1.83 1.23 1.07 1.84 2.8 1.31 3.48.99.11-.78.42-1.31.76-1.61-2.66-.3-5.47-1.33-5.47-5.92 0-1.31.47-2.38 1.23-3.22-.12-.3-.53-1.52.12-3.17 0 0 1-.32 3.3 1.23a11.4 11.4 0 0 1 6 0c2.3-1.55 3.3-1.23 3.3-1.23.65 1.65.24 2.87.12 3.17.77.84 1.23 1.91 1.23 3.22 0 4.6-2.82 5.6-5.5 5.9.43.37.81 1.1.81 2.22v3.29c0 .32.22.7.83.58A12 12 0 0 0 12 .5Z" />
    </svg>
  );
}

const getFriendlyAuthError = (message: string) => {
  if (!message) return 'Authentication failed. Please try again.';

  const lower = message.toLowerCase();

  if (lower.includes('invalid login credentials') || lower.includes('invalid credentials')) {
    return 'Invalid credentials. Please check your email and password.';
  }

  if (lower.includes('email already registered') || lower.includes('user already registered')) {
    return 'An account with this email already exists.';
  }

  if (lower.includes('signups not allowed') || lower.includes('sign up is disabled')) {
    return 'Sign-ups are temporarily disabled. Please try again later.';
  }

  if (lower.includes('password')) {
    return 'Password is invalid. Please use at least 6 characters.';
  }

  if (lower.includes('rate limit')) {
    return 'Too many attempts. Please wait a moment before trying again.';
  }

  return message;
};

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGithubLoading, setIsGithubLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        router.replace('/');
      }
    };

    void checkSession();
  }, [router]);

  const handleGithubAuth = async () => {
    setError(null);
    setMessage(null);
    setIsGithubLoading(true);

    try {
      const authPromise = (async () => {
        const { error: oauthError } = await supabase.auth.signInWithOAuth({
          provider: 'github',
          options: {
            redirectTo: `${window.location.origin}/`,
          },
        });

        if (oauthError) {
          throw oauthError;
        }
      })();

      await toast.promise(authPromise, {
        loading: 'Connecting to GitHub...',
        success: 'GitHub sign-in started successfully.',
        error: (err) => getFriendlyAuthError(err instanceof Error ? err.message : 'GitHub sign-in failed.'),
      });
    } catch (err) {
      const nextError = err instanceof Error ? getFriendlyAuthError(err.message) : 'GitHub sign-in failed.';
      setError(nextError);
      toast.error(nextError);
    } finally {
      setIsGithubLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError(null);

    if (mode === 'signup' && password !== confirmPassword) {
      const nextError = 'Passwords do not match. Please re-enter them.';
      setError(nextError);
      toast.error(nextError);
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const signUpPromise = (async () => {
          const response = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                full_name: fullName,
              },
            },
          });

          if (response.error) {
            throw response.error;
          }

          return response;
        })();

        const res = (await toast.promise(signUpPromise, {
          loading: 'Creating your account...',
          success: 'Account created successfully!',
          error: (err) => getFriendlyAuthError(err instanceof Error ? err.message : 'Sign-up failed.'),
        })) as any;

        if (res?.data?.user && !res.data.session) {
          setMessage('Check your inbox to confirm your email before logging in.');
          toast.success('Check your inbox to confirm your email before logging in.');
          return;
        }
      } else {
        const signInPromise = (async () => {
          const response = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (response.error) {
            throw response.error;
          }

          return response;
        })();

        await toast.promise(signInPromise, {
          loading: 'Signing you in...',
          success: 'Logged in successfully!',
          error: (err) => getFriendlyAuthError(err instanceof Error ? err.message : 'Authentication failed.'),
        });

        // Ensure Supabase client has the authenticated user before redirecting.
        // Some environments may not have the session immediately available,
        // so poll briefly for the user to be present.
        const waitForUser = async (retries = 10, delayMs = 250) => {
          for (let i = 0; i < retries; i++) {
            try {
              const { data } = await supabase.auth.getUser();
              if (data?.user) return true;
            } catch (e) {
              // ignore and retry
            }
            // small delay
            // eslint-disable-next-line no-await-in-loop
            await new Promise((r) => setTimeout(r, delayMs));
          }
          return false;
        };

        const hasUser = await waitForUser(12, 300);
        if (!hasUser) {
          // If no session yet, do a hard reload which allows server-side to pick up cookie/session.
          if (typeof window !== 'undefined') {
            window.location.reload();
            return;
          }
        }

        router.replace('/');
        }
      } catch (err) {
      const nextError = err instanceof Error ? getFriendlyAuthError(err.message) : 'Authentication failed.';
      setError(nextError);
      toast.error(nextError);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(24,24,27,0.06)] dark:border-zinc-800 dark:bg-zinc-950/90 dark:shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
        <div className="mb-7 flex justify-center items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-none border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-700 dark:bg-zinc-900">
            <img src="/zettel-icon2.png" alt="Zettel" className="h-full w-full object-cover" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
              {mode === 'login' ? 'Welcome to Zettel' : 'Create an account'}
            </h1>
          </div>
        </div>

        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          {mode === 'login'
            ? 'Sign in to continue capturing ideas, notes, and plans.'
            : 'Start building a more focused workspace for your thinking.'}
        </p>

        <button
          type="button"
          onClick={() => {
            void handleGithubAuth();
          }}
          disabled={isGithubLoading || isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-zinc-200 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-zinc-50 transition hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-70 dark:border-zinc-700 dark:bg-zinc-900 dark:hover:bg-zinc-800"
        >
          {isGithubLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <GitHubIcon />
          )}
          Continue with GitHub
        </button>

        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-zinc-400 dark:text-zinc-500">
            or
          </span>
          <div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        </div>

        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          {mode === 'signup' && (
            <div>
              <label htmlFor="fullName" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Full name
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  id="fullName"
                  type="text"
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  placeholder="Jane Doe"
                  autoComplete="name"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-indigo-500/10"
                />
              </div>
            </div>
          )}

          <div>
            <label htmlFor="email" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Email
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Enter your email"
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-indigo-500/10"
              />
            </div>
          </div>

          <div>
            <label htmlFor="password" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
              <input
                id="password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                required
                minLength={6}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={mode === 'login' ? 'Enter your password' : 'Create a password'}
                className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-indigo-500/10"
              />
            </div>
            <div className="mt-2 text-right">
              <Link href="/forgot-password" className="text-sm text-zinc-600 hover:underline dark:text-zinc-300">Forgot password?</Link>
            </div>
          </div>

          {mode === 'signup' && (
            <div>
              <label htmlFor="confirmPassword" className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">
                Confirm password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400 dark:text-zinc-500" />
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Confirm your password"
                  className="w-full rounded-xl border border-zinc-200 bg-zinc-50 py-2.5 pl-10 pr-3 text-sm text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-zinc-300 focus:ring-2 focus:ring-indigo-100 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:ring-indigo-500/10"
                />
              </div>
            </div>
          )}

          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-300"
            >
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || isGithubLoading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Please wait...
              </>
            ) : (
              <>
                {mode === 'login' ? 'Log in' : 'Create account'}
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
          <button
            type="button"
            onClick={() => {
              setMode((current) => (current === 'login' ? 'signup' : 'login'));
              setError(null);
              setMessage(null);
              setConfirmPassword('');
            }}
            className="font-medium text-zinc-900 underline-offset-4 transition hover:text-indigo-600 hover:underline dark:text-zinc-100 dark:hover:text-indigo-400"
          >
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </div>
      </div>
    </main>
  );
}
