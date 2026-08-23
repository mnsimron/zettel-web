"use client";

import Script from 'next/script';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

function isOneSignalSupportedHost(): boolean {
  if (typeof window === 'undefined') return false;

  const origin = window.location.origin;
  const hostname = window.location.hostname;

  return (
    origin === 'https://zettel-one.vercel.app' ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.endsWith('.vercel.app')
  );
}

export default function OneSignalProvider() {
  useEffect(() => {
    if (!appId || typeof window === 'undefined' || !isOneSignalSupportedHost()) {
      return;
    }

    const win = window as any;

    if (win.OneSignalInitialized) return;

    win.OneSignalDeferred = win.OneSignalDeferred || [];
    win.OneSignalDeferred.push(async function(OneSignal: any) {
      if (!OneSignal || typeof OneSignal.init !== 'function') return;
      if (win.OneSignalInitialized) return;

      win.OneSignalInitialized = true;

      try {
        await OneSignal.init({
          appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
          autoResubscribe: true
        });
      } catch (error) {
        win.OneSignalInitialized = false;
        console.error('OneSignal Init Error:', error);
      }
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !isOneSignalSupportedHost()) return;

    let mounted = true;

    const syncOneSignalUser = (id: string | null) => {
      const win = window as any;
      win.OneSignalDeferred = win.OneSignalDeferred || [];

      win.OneSignalDeferred.push(async (OneSignal: any) => {
        if (!OneSignal) return;

        if (id) {
          if (typeof OneSignal.login === 'function') {
            await OneSignal.login(id);
          }
        } else if (typeof OneSignal.logout === 'function') {
          await OneSignal.logout();
        }
      });
    };

    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id ?? null;
      if (mounted) syncOneSignalUser(id);
    })();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const id = session?.user?.id ?? null;
        if (mounted) syncOneSignalUser(id);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe?.();
    };
  }, []);

  if (!appId) return null;

  return (
    <Script
      id="onesignal-sdk"
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  );
}