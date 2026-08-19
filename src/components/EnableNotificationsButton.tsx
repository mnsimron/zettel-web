'use client';

import { Bell, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function EnableNotificationsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const win = window as any;
    win.OneSignalDeferred = win.OneSignalDeferred || [];
    win.OneSignalDeferred.push((OneSignal: any) => {
      try {
        const push = OneSignal?.User?.PushSubscription;
        setIsEnabled(Boolean(push?.optedIn));

        push?.addEventListener?.('change', (ev: any) => {
          setIsEnabled(Boolean(ev?.current?.optedIn));
        });
      } catch (err) {
        console.error('OneSignal deferred check error:', err);
      }
    });
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (typeof window === 'undefined') throw new Error('Window not available');

      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
      if (!appId) {
        throw new Error('OneSignal App ID is not configured.');
      }

      // Early detection: if browser has blocked notifications, bail out quickly
      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        const msg = 'Notifications are blocked in this browser. Please enable them in your browser settings.';
        toast.error(msg);
        setError(msg);
        return;
      }

      const win = window as any;

      // Safety delay: wait a short period before attempting to push/run the handler.
      // This helps detect when the SDK script was blocked by an AdBlocker (net::ERR_BLOCKED_BY_CLIENT).
      if (!win.OneSignal) {
        const safetyDelayMs = 3500;
        await new Promise((resolve) => setTimeout(resolve, safetyDelayMs));

        if (!win.OneSignal) {
          const msg = 'Push notifications are blocked by your browser or an AdBlocker. Please disable it and try again.';
          toast.error(msg);
          setError(msg);
          return;
        }
      }

      // Use a Promise that resolves once the handler runs (either immediately if OneSignal present, or via deferred), with timeout
      await new Promise<void>((resolve, reject) => {
        win.OneSignalDeferred = win.OneSignalDeferred || [];

        let settled = false;
        const timeoutMs = 10000; // 10s
        const timer = setTimeout(() => {
          if (!settled) {
            settled = true;
            reject(new Error('OneSignal initialization timed out'));
          }
        }, timeoutMs);

        const runHandler = (OneSignal: any) => {
          (async () => {
            try {
              if (OneSignal?.init) {
                await OneSignal.init({
                  appId,
                  notifyButton: { enable: false },
                  allowLocalhostAsSecureOrigin: true,
                  autoResubscribe: true,
                });
              }

              // show prompt (slidedown) if available
              if (OneSignal?.Slidedown?.promptPush) {
                await OneSignal.Slidedown.promptPush();
              } else if (OneSignal?.Notifications?.requestPermission) {
                await OneSignal.Notifications.requestPermission();
              }

              const { data: userData } = await supabase.auth.getUser();
              const user = userData?.user;

              if (!user) {
                throw new Error('User not authenticated.');
              }

              if (OneSignal?.login) {
                await OneSignal.login(user.id);
              }

              const push = OneSignal?.User?.PushSubscription;
              const subscriptionId = push?.id;

              if (subscriptionId) {
                const { error: upsertError } = await supabase
                  .from('profiles')
                  .update({
                    onesignal_id: subscriptionId,
                    push_notifications_enabled: true,
                    updated_at: new Date().toISOString(),
                  } as any)
                  .eq('id', user.id);

                if (upsertError) console.error('Failed to update profile with OneSignal ID:', upsertError);
              }

              if (!settled) {
                settled = true;
                clearTimeout(timer);
                setIsEnabled(true);
                toast.success('Notifications enabled successfully!');
                resolve();
              }
            } catch (err) {
              if (!settled) {
                settled = true;
                clearTimeout(timer);
                reject(err);
              }
            }
          })();
        };

        try {
          if (win.OneSignal) {
            // If SDK already loaded, run handler immediately
            runHandler(win.OneSignal);
          } else {
            // Otherwise push to deferred callbacks
            win.OneSignalDeferred.push((OneSignal: any) => runHandler(OneSignal));
          }
        } catch (err) {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        }
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to enable notifications.';
      setError(message);
      console.error('Enable notifications error:', err);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
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
