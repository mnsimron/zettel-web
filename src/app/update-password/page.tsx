'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function UpdatePasswordPage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;

      toast.success('Password updated successfully.');
      router.replace('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update password.';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4 py-12 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-[0_8px_30px_rgba(24,24,27,0.06)] dark:border-zinc-800 dark:bg-zinc-900/90">
        <h1 className="mb-2 text-lg font-semibold">Set a new password</h1>
        <p className="mb-4 text-sm text-zinc-500">Choose a new password for your account.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">New password</label>
            <input
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
              placeholder="New password"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-medium uppercase tracking-[0.14em] text-zinc-500">Confirm password</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-zinc-300"
              placeholder="Confirm password"
            />
          </div>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-70"
            >
              {isSubmitting ? 'Saving…' : 'Update password'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export default function UpdatePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: supError } = await supabase.auth.updateUser({ password });
      if (supError) throw supError;
      toast.success('Your password has been updated. Redirecting to login...');
      setTimeout(() => router.push('/login'), 1600);
    } catch (err) {
      console.error('Update password error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Set a new password</h1>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">Create a new password for your account.</p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New Password</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm Password</span>
            <input
              type="password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-1 w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none placeholder:text-zinc-400 focus:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100"
            />
          </label>

          <div className="flex items-center justify-end">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Save new password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
