'use client';

import { useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/update-password`,
      });

      if (error) throw error;

      toast.success('Password reset email sent. Check your inbox.');
      setEmail('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send reset email.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(24,24,27,0.06)] dark:border-zinc-800 dark:bg-zinc-900/90">
        <h1 className="mb-2 text-lg font-semibold">Reset your password</h1>
        <p className="mb-4 text-sm text-zinc-500">Enter your account email to receive a password reset link.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
              placeholder="you@example.com"
            />
          </div>

          <div className="flex items-center justify-between">
            <Link href="/login" className="text-sm text-zinc-600 hover:underline">Back to login</Link>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-70"
            >
              {isSubmitting ? 'Sending…' : 'Send reset email'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const redirectTo = `${location.origin}/update-password`;
      const { error: supError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (supError) throw supError;
      toast.success('Password reset link sent to your email.');
    } catch (err) {
      console.error('Forgot password error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to send reset email');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Forgot your password?</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Enter your email and we'll send a password reset link.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? 'Sending...' : 'Send reset link'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
