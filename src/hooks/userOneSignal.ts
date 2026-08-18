'use client';

import { useEffect, useState } from 'react';
import OneSignal from 'react-onesignal';
import { supabase } from '@/lib/supabase';

type OneSignalState = {
  isReady: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission | 'unknown';
  userId: string | null;
};

export function useOneSignal() {
  const [state, setState] = useState<OneSignalState>({
    isReady: false,
    isSubscribed: false,
    permission: 'unknown',
    userId: null,
  });

  useEffect(() => {
    const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

    if (!appId) {
      console.warn('OneSignal app ID is missing');
      return;
    }

    const init = async () => {
      try {
        // react-onesignal's types are restrictive; cast to `any` for runtime methods
        await (OneSignal as any).init({
          appId,
          notifyButton: { enable: false } as any,
          allowLocalhostAsSecureOrigin: true,
          autoResubscribe: true,
        } as any);

        const permission = Notification.permission;

        // Use OneSignal v15+ User-centric API for subscription info
        const push = (OneSignal as any).User?.PushSubscription;
        const subscriptionId = push?.id ?? null;

        setState({
          isReady: true,
          isSubscribed: !!push?.optedIn,
          permission,
          userId: subscriptionId,
        });
      } catch (error) {
        console.error('OneSignal init error:', error);
      }
    };

    void init();
  }, []);

  return state;
}