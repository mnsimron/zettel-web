'use client';

import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useSyncOneSignal(userId?: string) {
  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    // Use local any cast to avoid global TS collisions
    const win = window as any;
    win.OneSignalDeferred = win.OneSignalDeferred || [];

    // Cancel token in case the component unmounts
    let cancelled = false;

    win.OneSignalDeferred.push(async (OneSignal: any) => {
      if (cancelled) return;
      try {
        // Prefer setExternalUserId when available (v16+)
        if (OneSignal?.setExternalUserId) {
          await OneSignal.setExternalUserId(userId);
        } else if (OneSignal?.login) {
          // older API fallback
          await OneSignal.login(userId);
        } else if (OneSignal?.sendTag) {
          // as a last-resort, tag the user
          await OneSignal.sendTag('user_id', userId);
        }
        // optional: verify mapping by reading OneSignal.User.PushSubscription or logging
      } catch (err) {
        console.error('OneSignal sync error:', err);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [userId]);
}