'use client';

import { Bell, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

const ONE_SIGNAL_TIMEOUT_MS = 5000;

type OneSignalInstance = {
  init?: (options: Record<string, unknown>) => Promise<void> | void;
  login?: (userId: string) => Promise<void> | void;
  Slidedown?: { promptPush?: () => Promise<void> | void };
  Notifications?: { requestPermission?: () => Promise<void> | void };
  User?: {
    PushSubscription?: {
      id?: string;
      optedIn?: boolean;
      addEventListener?: (event: string, handler: (event: any) => void) => void;
    };
  };
};

type OneSignalWindow = Window & {
  OneSignal?: OneSignalInstance;
  OneSignalDeferred?: Array<(oneSignal: OneSignalInstance) => void>;
};

export function EnableNotificationsButton() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const missingConfiguration = !appId || !supabaseUrl || !supabaseAnonKey;

  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    console.debug('[EnableNotificationsButton] Mounting', {
      hasAppId: Boolean(appId),
      hasSupabaseUrl: Boolean(supabaseUrl),
      hasSupabaseAnonKey: Boolean(supabaseAnonKey),
    });

    if (missingConfiguration) {
      const message = 'Notification configuration is missing. Please contact the administrator.';
      console.error('[EnableNotificationsButton] Critical configuration missing', {
        hasAppId: Boolean(appId),
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasSupabaseAnonKey: Boolean(supabaseAnonKey),
      });
      setError(message);
      toast.error(message);
      return;
    }

    if (typeof window === 'undefined') return;

    console.debug('[EnableNotificationsButton] Checking OneSignal subscription');
    const oneSignalWindow = window as OneSignalWindow;
    oneSignalWindow.OneSignalDeferred = oneSignalWindow.OneSignalDeferred || [];

    oneSignalWindow.OneSignalDeferred.push((oneSignal) => {
      try {
        const push = oneSignal?.User?.PushSubscription;
        console.debug('[EnableNotificationsButton] OneSignal subscription checked', {
          optedIn: Boolean(push?.optedIn),
          subscriptionId: Boolean(push?.id),
        });
        setIsEnabled(Boolean(push?.optedIn));

        push?.addEventListener?.('change', (event) => {
          console.debug('[EnableNotificationsButton] Subscription state changed', event);
          setIsEnabled(Boolean(event?.current?.optedIn));
        });
      } catch (checkError) {
        console.error('[EnableNotificationsButton] OneSignal subscription check failed', checkError);
      }
    });

    return () => {
      console.debug('[EnableNotificationsButton] Unmounting');
    };
  }, [appId, missingConfiguration, supabaseAnonKey, supabaseUrl]);

  const handleEnable = async () => {
    console.debug('[EnableNotificationsButton] Enable clicked');
    setIsLoading(true);
    setError(null);

    try {
      if (missingConfiguration || !appId) {
        throw new Error('Notification configuration is missing. Please contact the administrator.');
      }

      if (typeof window === 'undefined') {
        throw new Error('Notifications are only available in a browser.');
      }

      if (typeof Notification !== 'undefined' && Notification.permission === 'denied') {
        throw new Error('Notifications are blocked in this browser. Enable them in browser settings.');
      }

      const oneSignalWindow = window as OneSignalWindow;
      console.debug('[EnableNotificationsButton] Checking OneSignal SDK before request', {
        sdkLoaded: Boolean(oneSignalWindow.OneSignal),
      });

      await new Promise<void>((resolve, reject) => {
        let settled = false;
        const timeout = window.setTimeout(() => {
          if (settled) return;
          settled = true;
          console.error('[EnableNotificationsButton] OneSignal request timed out or was blocked');
          reject(new Error('Notification request timed out or was blocked by the browser.'));
        }, ONE_SIGNAL_TIMEOUT_MS);

        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          window.clearTimeout(timeout);
          callback();
        };

        const runRequest = (oneSignal: OneSignalInstance) => {
          void (async () => {
            try {
              if (settled) return;
              console.debug('[EnableNotificationsButton] OneSignal instance received');

              const win = window as OneSignalWindow & { OneSignalInitialized?: boolean };
              if (oneSignal.init && !win.OneSignalInitialized) {
                console.debug('[EnableNotificationsButton] Initializing OneSignal');
                win.OneSignalInitialized = true;
                try {
                  await oneSignal.init({
                    appId,
                    notifyButton: { enable: false },
                    allowLocalhostAsSecureOrigin: true,
                    autoResubscribe: true,
                  });
                } catch (initError) {
                  win.OneSignalInitialized = false;
                  throw initError;
                }
              }

              if (settled) return;
              console.debug('[EnableNotificationsButton] Requesting notification permission');
              if (oneSignal.Slidedown?.promptPush) {
                await oneSignal.Slidedown.promptPush();
              } else if (oneSignal.Notifications?.requestPermission) {
                await oneSignal.Notifications.requestPermission();
              } else {
                throw new Error('OneSignal permission API is unavailable.');
              }

              if (settled) return;
              console.debug('[EnableNotificationsButton] Reading authenticated Supabase user');
              const { data: userData, error: userError } = await supabase.auth.getUser();
              if (userError) throw userError;
              const user = userData.user;
              if (!user) throw new Error('User not authenticated.');

              if (oneSignal.login) {
                console.debug('[EnableNotificationsButton] Linking OneSignal user', { userId: user.id });
                await oneSignal.login(user.id);
              }

              const subscriptionId = oneSignal.User?.PushSubscription?.id;
              if (!subscriptionId) {
                throw new Error('Notification permission was not completed. Please try again.');
              }

              console.debug('[EnableNotificationsButton] Supabase profile update starting', {
                subscriptionId,
              });
              try {
                const { error: updateError } = await supabase
                  .from('profiles')
                  .update({
                    onesignal_id: subscriptionId,
                    push_notifications_enabled: true,
                    updated_at: new Date().toISOString(),
                  } as any)
                  .eq('id', user.id);

                if (updateError) throw updateError;
                console.debug('[EnableNotificationsButton] Supabase profile update completed');
              } catch (updateError) {
                const code = typeof updateError === 'object' && updateError !== null && 'code' in updateError
                  ? (updateError as { code?: string }).code
                  : undefined;
                console.error('[EnableNotificationsButton] Supabase profile update failed', {
                  code,
                  error: updateError,
                });
                throw new Error(code ? `Failed to save notification settings (${code}).` : 'Failed to save notification settings.');
              }

              finish(() => {
                setIsEnabled(true);
                toast.success('Notifications enabled successfully!');
                resolve();
              });
            } catch (requestError) {
              finish(() => reject(requestError));
            }
          })();
        };

        try {
          oneSignalWindow.OneSignalDeferred = oneSignalWindow.OneSignalDeferred || [];
          if (oneSignalWindow.OneSignal) {
            runRequest(oneSignalWindow.OneSignal);
          } else {
            console.debug('[EnableNotificationsButton] OneSignal is not loaded; waiting on deferred SDK');
            oneSignalWindow.OneSignalDeferred.push(runRequest);
          }
        } catch (queueError) {
          finish(() => reject(queueError));
        }
      });
    } catch (enableError) {
      const message = enableError instanceof Error ? enableError.message : 'Unable to enable notifications.';
      console.error('[EnableNotificationsButton] Enable request failed', enableError);
      setError(message);
      toast.error(message);
    } finally {
      console.debug('[EnableNotificationsButton] Resetting loading state');
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleEnable()}
      disabled={isLoading || missingConfiguration}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 ${
        isEnabled ? 'text-indigo-600 dark:text-indigo-400' : 'text-zinc-700 dark:text-zinc-200'
      }`}
      aria-label={isEnabled ? 'Notifications enabled; click to refresh' : 'Enable notifications'}
      title={error || (isEnabled ? 'Notifications enabled; click to refresh' : 'Enable notifications')}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
    </button>
  );
}
