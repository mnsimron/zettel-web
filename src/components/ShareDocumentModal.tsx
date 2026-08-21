'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface ShareDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  documentId: string;
  documentName?: string;
  currentUserId?: string;
}

export default function ShareDocumentModal({
  isOpen,
  onClose,
  onSuccess,
  documentId,
  documentName = 'Untitled Document',
  currentUserId,
}: ShareDocumentModalProps) {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    setEmail('');
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const normalizedEmail = email.trim();

    if (!normalizedEmail) {
      setError('Please enter an email address.');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Please enter a valid email address.');
      return;
    }

    if (!currentUserId) {
      setError('You must be logged in to share this document.');
      return;
    }

    setIsLoading(true);

    try {
      const { data: invitedUser, error: userLookupError } = await supabase
        .from('profiles')
        .select('id, email')
        .ilike('email', normalizedEmail)
        .limit(1)
        .maybeSingle();

      if (userLookupError) {
        throw userLookupError;
      }

      if (!invitedUser) {
        throw new Error('No user was found with that email address.');
      }

      if (invitedUser.id === currentUserId) {
        throw new Error('You cannot invite yourself to your own document.');
      }

      const { error: collaboratorInsertError } = await supabase
        .from('document_collaborators')
        .insert([
          {
            document_id: documentId,
            user_id: invitedUser.id,
            granted_by: currentUserId,
            role: 'editor',
          },
        ]);

      if (collaboratorInsertError) {
        throw collaboratorInsertError;
      }

      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserIds: [invitedUser.id],
          title: 'Collaboration Invite 🤝',
          message: `Someone invited you to collaborate on the document ${documentName}`,
        }),
      });

      if (!res.ok) {
        // Try to parse JSON error from the API for friendlier messages
        let body: any = null;
        try {
          body = await res.json();
        } catch (_) {
          // ignore parse errors
        }

        const errMsg = body?.error ?? body?.message ?? (await res.text()) ?? 'Failed to send collaboration notification.';
        throw new Error(typeof errMsg === 'string' ? errMsg : JSON.stringify(errMsg));
      }

      toast.success('Invitation sent!');
      onSuccess?.();
      handleClose();
    } catch (err: unknown) {
      // Handle Postgres unique-constraint (duplicate collaborator) gracefully
      if ((err as any)?.code === '23505') {
        const message = 'This user already has access to this document';
        setError(message);
        toast.error(message);
      } else {
        const message = err instanceof Error ? err.message : 'Unable to send invitation.';
        setError(message);
        toast.error(message);
      }

      console.error('Share document error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={handleClose} />

      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Share Document
            </h2>
            <button
              type="button"
              onClick={handleClose}
              className="text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="Close share dialog"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="share-email"
                  className="mb-2 block text-xs font-medium text-zinc-700 dark:text-zinc-300"
                >
                  Invite by email
                </label>
                <input
                  id="share-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                  placeholder="name@example.com"
                  autoFocus
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm placeholder-zinc-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-zinc-50 disabled:text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder-zinc-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
                />
              </div>

              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                This will grant access to the current document and send a collaboration invite.
              </p>

              {error && (
                <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isLoading}
                className="flex-1 rounded border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="flex-1 rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-400 dark:hover:bg-indigo-500"
              >
                {isLoading ? 'Loading...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
