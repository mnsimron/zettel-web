import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    // 1. Tangkap data yang dikirim dari frontend aplikasi kita
    const { targetUserIds, title, message } = await request.json();

    // 2. Validasi sederhana
    if (!targetUserIds || !targetUserIds.length || !message) {
      return NextResponse.json(
        { error: 'Target user (ID Supabase) dan pesan wajib diisi!' },
        { status: 400 }
      );
    }


    // 3. Build payload using OneSignal's expected fields
    // Use server-side env for secret REST API key and app id
    const ONESIGNAL_REST_API_KEY = process.env.ONESIGNAL_REST_API_KEY;
    const ONESIGNAL_APP_ID = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID;

    if (!ONESIGNAL_REST_API_KEY) {
      console.error('ONESIGNAL_REST_API_KEY is not set');
      return NextResponse.json({ error: 'Server misconfiguration: missing OneSignal REST key' }, { status: 500 });
    }

    if (!ONESIGNAL_APP_ID) {
      console.error('ONESIGNAL_APP_ID is not set');
      return NextResponse.json({ error: 'Server misconfiguration: missing OneSignal App ID' }, { status: 500 });
    }

    const payload = {
      app_id: ONESIGNAL_APP_ID,
      // target push notifications to external_user_ids (mapped from your Supabase user IDs)
      include_external_user_ids: targetUserIds,
      headings: { en: title || 'Notifikasi Zettel' },
      contents: { en: message },
    };

    // 4. Send to OneSignal with the exact Authorization header they expect
    const restKey = String(ONESIGNAL_REST_API_KEY).trim();

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        // OneSignal expects the REST API key in a Basic Authorization header
        'Authorization': 'Basic ' + restKey,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.error('OneSignal responded with an error:', response.status, data);
      // Return OneSignal's error details to the client for better debugging
      const message = data?.errors ? (Array.isArray(data.errors) ? data.errors.join(', ') : String(data.errors)) : `OneSignal responded with status ${response.status}`;
      return NextResponse.json({ error: message, details: data }, { status: response.status });
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error Notify API:', error.message);
    return NextResponse.json({ error: 'Terjadi kesalahan di server' }, { status: 500 });
  }
}