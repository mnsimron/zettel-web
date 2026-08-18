'use client';

import { Bell, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { supabase } from '@/lib/supabase';

export function EnableNotificationsButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkPermission = async () => {
      if (!('Notification' in window)) return;

      // Use OneSignal v15+ User-centric API
      const push = (OneSignal as any).User?.PushSubscription;

      setIsEnabled(!!push?.optedIn);
    };

    void checkPermission();
  }, []);

  const handleEnable = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

      if (!appId) {
        throw new Error('OneSignal App ID is not configured.');
      }

      // Use `any` because `react-onesignal` types are restrictive
      await (OneSignal as any).init({
        appId,
        notifyButton: { enable: false } as any,
        allowLocalhostAsSecureOrigin: true,
        autoResubscribe: true,
      } as any);

      // Trigger the browser permission prompt
      await (OneSignal as any).Slidedown.promptPush();

      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        throw new Error('User not authenticated.');
      }

      // OneSignal external user mapping
      await (OneSignal as any).login(user.id);

      // Read the new v15+ subscription info
      const push = (OneSignal as any).User?.PushSubscription;
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

        if (upsertError) {
          console.error('Failed to update profile with OneSignal ID:', upsertError);
        }
      }

      setIsEnabled(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to enable notifications.';
      setError(message);
      console.error('OneSignal enable error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleEnable()}
      disabled={isLoading || isEnabled}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white p-1.5 text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
      aria-label={isEnabled ? 'Notifications enabled' : 'Enable notifications'}
      title={isEnabled ? 'Notifications enabled' : 'Enable notifications'}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bell className="h-4 w-4" />}
    </button>
  );
}