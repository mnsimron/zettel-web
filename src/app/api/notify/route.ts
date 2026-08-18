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

    // 3. Konfigurasi Payload untuk OneSignal
    const payload = {
      app_id: process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID,
      target_channel: 'push',
      // INI KUNCINYA: Kita targetkan langsung ke ID Supabase pengguna (external_id)
      include_aliases: {
        external_id: targetUserIds, 
      },
      headings: { en: title || 'Notifikasi Zettel' },
      contents: { en: message },
      // Opsional: Tambahkan URL jika ingin notifikasi bisa diklik dan membuka halaman tertentu
      // url: "https://zettel-one.vercel.app/doc/123"
    };

    // 4. Tembak server OneSignal!
    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${process.env.ONESIGNAL_REST_API_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.errors ? data.errors.join(', ') : 'Gagal mengirim OneSignal');
    }

    return NextResponse.json({ success: true, data });

  } catch (error: any) {
    console.error('Error Notify API:', error.message);
    return NextResponse.json({ error: 'Terjadi kesalahan di server' }, { status: 500 });
  }
}