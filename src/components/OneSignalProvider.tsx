"use client";

import Script from 'next/script';
import { useEffect } from 'react';

const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

export default function OneSignalProvider() {
  useEffect(() => {
    if (!appId || typeof window === 'undefined') return;

    const win = window as any;

    // Bendera penanda: Jika sudah pernah init, hentikan proses ini!
    if (win.OneSignalInitialized) return;
    
    win.OneSignalDeferred = win.OneSignalDeferred || [];
    win.OneSignalDeferred.push(async function(OneSignal: any) {
      try {
        await OneSignal.init({
          appId: appId,
          allowLocalhostAsSecureOrigin: true,
          notifyButton: { enable: false },
          autoResubscribe: true
        });
        
        // Tandai bahwa mesin sudah menyala
        win.OneSignalInitialized = true;
      } catch (error) {
        console.error("OneSignal Init Error:", error);
      }
    });
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