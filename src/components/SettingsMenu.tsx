"use client";

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Settings, Bell, Lock, LogOut, X, Check } from 'lucide-react';
import { toast } from 'sonner';

export function SettingsMenu() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // State untuk Toggle OneSignal
  const [isPushEnabled, setIsPushEnabled] = useState(false);
  const [isPushLoading, setIsPushLoading] = useState(false);

  const rootRef = useRef<HTMLDivElement | null>(null);

  const getOneSignal = () => {
    if (typeof window === 'undefined') return null;
    return (window as any).OneSignal ?? null;
  };

  // Menutup dropdown jika user klik di luar menu
  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      const el = rootRef.current;
      if (!el) return;
      if (e.target instanceof Node && !el.contains(e.target)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Cek status OneSignal saat komponen dimuat
  useEffect(() => {
    const OneSignal = getOneSignal();
    if (!OneSignal) {
      const waitForInit = window.setTimeout(() => {
        const latestOneSignal = getOneSignal();
        if (!latestOneSignal) return;

        const subscription = latestOneSignal.User?.PushSubscription;
        if (!subscription) return;

        setIsPushEnabled(Boolean(subscription.optedIn));
        subscription.addEventListener?.('change', (event: any) => {
          setIsPushEnabled(Boolean(event?.current?.optedIn));
        });
      }, 500);

      return () => window.clearTimeout(waitForInit);
    }

    const subscription = OneSignal.User?.PushSubscription;
    if (!subscription) return;

    setIsPushEnabled(Boolean(subscription.optedIn));
    subscription.addEventListener?.('change', (event: any) => {
      setIsPushEnabled(Boolean(event?.current?.optedIn));
    });

    return () => {
      subscription.removeEventListener?.('change', (event: any) => {
        setIsPushEnabled(Boolean(event?.current?.optedIn));
      });
    };
  }, []);

  const handleTogglePush = async () => {
    const OneSignal = getOneSignal();
    const pushSubscription = OneSignal?.User?.PushSubscription;

    if (!OneSignal || !pushSubscription) {
      toast.error('OneSignal belum siap. Silakan coba lagi sebentar.');
      return;
    }

    setIsPushLoading(true);

    try {
      const shouldEnable = !isPushEnabled;
      setIsPushEnabled(shouldEnable);

      if (shouldEnable) {
        await OneSignal.Notifications.requestPermission();
        await pushSubscription.optIn();
        toast.success('Push notifications enabled!');
      } else {
        await pushSubscription.optOut();
        toast.success('Push notifications disabled.');
      }
    } catch (error) {
      console.error('OneSignal Toggle Error:', error);
      setIsPushEnabled(!isPushEnabled);
      toast.error('Gagal mengubah pengaturan notifikasi.');
    } finally {
      setIsPushLoading(false);
    }
  };

  const handleOpenChangePassword = () => {
    setNewPassword('');
    setConfirmPassword('');
    setShowChangePassword(true);
    setOpen(false); // Tutup dropdown
  };

  const handleSavePassword = async () => {
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: supError } = await supabase.auth.updateUser({ password: newPassword });
      if (supError) throw supError;
      
      toast.success('Password updated successfully.');
      setTimeout(() => setShowChangePassword(false), 900);
    } catch (err) {
      console.error('Change password error:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      if (typeof window !== 'undefined') {
        window.location.assign('/login');
      } else {
        router.replace('/login');
      }
    } catch (err) {
      console.error('Sign out error:', err);
      toast.error('Failed to sign out. Please try again.');
    }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center rounded-md p-2 text-zinc-600 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
        aria-expanded={open}
        aria-label="Open settings"
      >
        <Settings className="h-5 w-5" />
      </button>

      {open && (
        <div className="absolute bottom-full right-0 z-50 mb-2 w-56 rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="py-2">
            
            {/* ITEM 1: TOGGLE NOTIFICATIONS */}
            <div className="flex w-full items-center justify-between px-3 py-2 text-sm text-zinc-700 dark:text-zinc-200">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <span>Notifications</span>
              </div>
              
              {/* Toggle Switch UI */}
              <button
                type="button"
                role="switch"
                aria-checked={isPushEnabled}
                disabled={isPushLoading}
                onClick={handleTogglePush}
                className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50 dark:focus:ring-offset-zinc-900 ${
                  isPushEnabled ? 'bg-indigo-600' : 'bg-zinc-300 dark:bg-zinc-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isPushEnabled ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* ITEM 2: CHANGE PASSWORD */}
            <button
              type="button"
              onClick={handleOpenChangePassword}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800 transition-colors"
            >
              <Lock className="h-4 w-4" />
              Change Password
            </button>

            <div className="my-1 border-t border-zinc-100 dark:border-zinc-800" />

            {/* ITEM 3: SIGN OUT */}
            <button
              type="button"
              onClick={handleSignOut}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/30 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </div>
      )}

      {/* Modal Change Password tetap sama... */}
      {showChangePassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl dark:bg-zinc-900 dark:border dark:border-zinc-800">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-50">Change Password</h3>
              <button 
                type="button" 
                onClick={() => setShowChangePassword(false)} 
                className="rounded-full p-1 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">New Password</span>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-indigo-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm Password</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="mt-1.5 w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2.5 text-sm outline-none transition focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-indigo-500"
                />
              </label>

              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowChangePassword(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => void handleSavePassword()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-60 transition-colors"
                >
                  {loading ? 'Saving...' : 'Save Password'}
                  {!loading && <Check className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}