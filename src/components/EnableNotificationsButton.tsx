'use client';

import { Bell, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function EnableNotificationsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);

  // Cek status OneSignal saat komponen dimuat
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const win = window as any;
    win.OneSignalDeferred = win.OneSignalDeferred || [];
    win.OneSignalDeferred.push((OneSignal: any) => {
      try {
        const push = OneSignal?.User?.PushSubscription;
        setIsEnabled(Boolean(push?.optedIn));

        // Dengarkan jika user mematikan/menyalakan dari setelan browser
        push?.addEventListener?.('change', (ev: any) => {
          setIsEnabled(Boolean(ev?.current?.optedIn));
        });
      } catch (err) {
        console.error('OneSignal deferred check error:', err);
      }
    });
  }, []);

  const handleEnable = async () => {
    // Early detection: jika browser memblokir notifikasi
    if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
      toast.error('Notifications are blocked in this browser. Please enable them in your URL bar settings.');
      return;
    }

    setIsLoading(true);

    const win = window as any;
    win.OneSignalDeferred = win.OneSignalDeferred || [];

    // Kita gunakan push() agar dieksekusi begitu OneSignal siap
    win.OneSignalDeferred.push(async (OneSignal: any) => {
      try {
        // 1. Minta izin notifikasi (TIDAK PERLU init() lagi)
        if (OneSignal?.Slidedown?.promptPush) {
          await OneSignal.Slidedown.promptPush();
        } else if (OneSignal?.Notifications?.requestPermission) {
          await OneSignal.Notifications.requestPermission();
        }

        // Cek apakah user akhirnya menyetujui (Opted In)
        const isOptedIn = OneSignal?.User?.PushSubscription?.optedIn;
        if (!isOptedIn) {
          setIsLoading(false);
          return; // Batal berlangganan, tidak perlu lanjut ke Supabase
        }

        // 2. Ambil data user dari Supabase
        const { data: userData, error: authError } = await supabase.auth.getUser();
        const user = userData?.user;

        if (authError || !user) {
          throw new Error('User not authenticated.');
        }

        // 3. Daftarkan user ke OneSignal dengan ID mereka
        if (OneSignal?.login) {
          await OneSignal.login(user.id);
        }

        // 4. Simpan OneSignal ID ke tabel profiles di Supabase
        const subscriptionId = OneSignal?.User?.PushSubscription?.id;
        if (subscriptionId) {
        const { error: upsertError } = await supabase
          .from('profiles')
          .update({
            onesignal_id: subscriptionId,
            push_notifications_enabled: true,
            updated_at: new Date().toISOString(),
          } as any)
          .eq('id', user.id);

          if (upsertError) {
            console.error('Failed to update profile:', upsertError);
            throw new Error('Failed to save notification settings to database.');
          }
        }

        setIsEnabled(true);
        toast.success('Notifications enabled successfully!');
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unable to enable notifications.';
        console.error('Enable notifications error:', err);
        toast.error(message);
      } finally {
        setIsLoading(false);
      }
    });
  };

  return (
    <button
      type="button"
      onClick={() => void handleEnable()}
      disabled={isLoading || isEnabled}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${
        isEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-200'
      }`}
      aria-label={isEnabled ? 'Notifications enabled' : 'Enable notifications'}
      title={isEnabled ? 'Notifications enabled' : 'Enable notifications'}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
    </button>
  );
}