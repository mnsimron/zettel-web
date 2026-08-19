'use client';

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export function TestNotifyButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData?.user;

      if (!user) {
        throw new Error('User not authenticated');
      }

      const payload = {
        targetUserIds: [user.id],
        title: 'Zettel Automations 🪄',
        message: 'This notification was sent automatically from the API for testing.',
      };

      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        // Try to parse JSON error bodies from the API first
        let serverMessage = 'Failed to send notification';
        try {
          const json = await res.json();
          if (json) {
            serverMessage = json.error || json.message || JSON.stringify(json);
          }
        } catch (_) {
          // fall back to plain text
          try {
            const text = await res.text();
            if (text) serverMessage = text;
          } catch (_) {
            /* ignore */
          }
        }

        throw new Error(serverMessage);
      }

      toast.success('Notification sent!');
    } catch (err) {
      console.error('TestNotifyButton error:', err);
      const message = err instanceof Error ? err.message : 'Failed to send notification.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
    >
      {loading ? 'Loading...' : 'Test Notify'}
    </button>
  );
}
