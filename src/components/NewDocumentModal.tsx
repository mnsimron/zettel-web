'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type DocumentInsert = Database['public']['Tables']['documents']['Insert'];

interface NewDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDocumentCreated: (documentId: string) => void;
  onSuccess?: () => void;
  workspaceId: string;
  userId?: string;
  parentId?: string | null;
}

export default function NewDocumentModal({
  isOpen,
  onClose,
  onDocumentCreated,
  onSuccess,
  workspaceId,
  userId,
  parentId,
}: NewDocumentModalProps) {
  const [title, setTitle] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('Document title is required');
      return;
    }

    setIsLoading(true);

    try {
      const newDocument: DocumentInsert = {
        title: title.trim(),
        workspace_id: workspaceId,
        parent_id: parentId ?? null,
        content: '',
        created_by: userId ?? null,
      };

      const { data, error: insertError } = await supabase
        .from('documents')
        .insert([newDocument])
        .select()
        .single();

      if (insertError) {
        throw insertError;
      }

      if (data) {
        setTitle('');
        onSuccess?.();
        onDocumentCreated(data.id);
        onClose();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create document';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2">
        <div className="rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-zinc-200 px-6 py-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              New Document
            </h2>
            <button
              onClick={handleClose}
              className="text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content */}
          <form onSubmit={handleSubmit} className="p-6">
            <div className="space-y-4">
              {/* Input Field */}
              <div>
                <label
                  htmlFor="title"
                  className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-2"
                >
                  Document Title
                </label>
                <input
                  id="title"
                  type="text"
                  placeholder="Untitled"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                  className="w-full rounded border border-zinc-200 bg-white px-3 py-2 text-sm placeholder-zinc-400 transition-colors focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-zinc-50 disabled:text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:placeholder-zinc-500 dark:focus:border-indigo-500 dark:focus:ring-indigo-500 dark:disabled:bg-zinc-800 dark:disabled:text-zinc-400"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="text-xs text-red-600 dark:text-red-400">
                  {error}
                </div>
              )}
            </div>

            {/* Actions */}
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
                disabled={isLoading || !title.trim()}
                className="flex-1 rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-indigo-700 disabled:bg-indigo-400 dark:hover:bg-indigo-500"
              >
                {isLoading ? 'Creating...' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
