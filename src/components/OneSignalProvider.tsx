"use client";

import Script from 'next/script';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase'; // Pastikan path ini sesuai dengan proyek Anda

const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

// NOTE: avoid global Window augmentation here to prevent conflicts with OneSignal SDK types.

export default function OneSignalProvider() {
  
  // --------------------------------------------------------
  // TUGAS 1: INISIALISASI ONESIGNAL (Hanya Jalan 1x)
  // --------------------------------------------------------
  useEffect(() => {
    if (!appId || typeof window === 'undefined') return;

    const win = window as any;
    
    // Cegah inisialisasi ganda di production atau Strict Mode
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
        
        win.OneSignalInitialized = true;
      } catch (error) {
        console.error("OneSignal Init Error:", error);
      }
    });
  }, []);

  // --------------------------------------------------------
  // TUGAS 2: SINKRONISASI USER ID (Mencegah external_id kosong)
  // --------------------------------------------------------
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let mounted = true;

    // Fungsi untuk menembakkan ID ke OneSignal
    const syncOneSignalUser = (id: string | null) => {
      const win = window as any;
      win.OneSignalDeferred = win.OneSignalDeferred || [];
      
      win.OneSignalDeferred.push(async (OneSignal: any) => {
        if (id) {
          await OneSignal.login(id); // Set external_id di OneSignal
        } else {
          await OneSignal.logout();  // Hapus jika user log out
        }
      });
    };

    // a. Cek sesi saat halaman pertama kali dimuat
    (async () => {
      const { data } = await supabase.auth.getUser();
      const id = data?.user?.id ?? null;
      if (mounted) syncOneSignalUser(id);
    })();

    // b. Pantau terus jika user melakukan Login / Logout
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const id = session?.user?.id ?? null;
        if (mounted) syncOneSignalUser(id);
      }
    );

    // Cleanup listener jika komponen dihancurkan
    return () => {
      mounted = false;
      authListener.subscription.unsubscribe?.();
    };
  }, []);

  // Jika App ID tidak ada, jangan muat apapun
  if (!appId) return null;

  return (
    <Script
      id="onesignal-sdk"
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="afterInteractive"
    />
  );
}