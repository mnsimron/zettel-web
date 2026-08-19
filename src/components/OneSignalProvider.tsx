"use client";

import Script from 'next/script';
import { useEffect } from 'react';

const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

const getOneSignalWindow = () => window as any;

export default function OneSignalProvider() {
  useEffect(() => {
    if (!appId || typeof window === 'undefined') {
      console.warn('OneSignal app ID is not configured.');
      return;
    }

    const waitForOneSignal = () => {
      const oneSignalWindow = getOneSignalWindow();

      if (oneSignalWindow.OneSignal) {
        return;
      }

      window.setTimeout(waitForOneSignal, 200);
    };

    waitForOneSignal();
  }, []);

  if (!appId) {
    return null;
  }

  return (
    <>
      <Script
        id="onesignal-sdk"
        src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
        strategy="afterInteractive"
      />

      <Script id="onesignal-init" strategy="afterInteractive">
        {`
          window.OneSignalDeferred = window.OneSignalDeferred || [];
          window.OneSignalDeferred.push(function(OneSignal) {
            OneSignal.init({
              appId: "${appId}",
              allowLocalhostAsSecureOrigin: true,
              notifyButton: { enable: false },
              autoResubscribe: true
            });
          });
        `}
      </Script>
    </>
  );
}
