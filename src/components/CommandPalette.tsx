'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { Search, Command, ArrowUp, ArrowDown, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Document = Database['public']['Tables']['documents_accessible']['Row'];

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument: (documentId: string) => void;
  workspaceId: string;
}

export default function CommandPalette({
  isOpen,
  onClose,
  onSelectDocument,
  workspaceId,
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const selectedItemRef = useRef<HTMLButtonElement>(null);

  // Fetch documents on component mount
  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);

      try {
        const user = (await supabase.auth.getUser()).data.user;
        const userId = user?.id;

        console.log('CommandPalette.fetchDocuments input', { workspaceId, userId });

        let query = supabase.from('documents_accessible').select().is('parent_id', null);

        if (userId) {
          const orFilter = `workspace_id.eq.${workspaceId},collaborator_ids.cs.{${userId}}`;
          query = query.or(orFilter).order('created_at', { ascending: false });
        } else {
          query = query.eq('workspace_id', workspaceId).order('created_at', { ascending: false });
        }

        const { data, error } = await query;

        console.log('CommandPalette.fetchDocuments result', { data, error });

        if (error) throw error;
        setDocuments(data || []);
      } catch (err) {
        console.error('Failed to fetch documents:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();

    // Subscribe to real-time changes using Supabase v2 syntax
    const channel = supabase
      .channel(`public:documents:cmd-palette:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'documents',
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newDoc = payload.new as Document;
            if (!newDoc.parent_id) {
              setDocuments((prev) => [newDoc, ...prev]);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedDoc = payload.new as Document;
            setDocuments((prev) =>
              prev.map((doc) => (doc.id === updatedDoc.id ? updatedDoc : doc))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedDoc = payload.old as Document;
            setDocuments((prev) => prev.filter((doc) => doc.id !== deletedDoc.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  // Filter documents based on search query
  useEffect(() => {
    const query = searchQuery.toLowerCase();
    const filtered = documents.filter(
      (doc) =>
        doc.title.toLowerCase().includes(query) ||
        (doc.content && doc.content.toLowerCase().includes(query))
    );
    setFilteredDocuments(filtered);
    setSelectedIndex(0);
  }, [searchQuery, documents]);

  // Focus input when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll selected item into view
  useEffect(() => {
    selectedItemRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [selectedIndex]);

  const handleSelectDocument = useCallback(
    (documentId: string) => {
      onSelectDocument(documentId);
      onClose();
      setSearchQuery('');
    },
    [onSelectDocument, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) =>
            prev < filteredDocuments.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredDocuments[selectedIndex]) {
            handleSelectDocument(filteredDocuments[selectedIndex].id);
          }
          break;
        case 'Escape':
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filteredDocuments, selectedIndex, handleSelectDocument, onClose]
  );

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Command Palette */}
      <div className="fixed left-1/2 top-1/4 z-50 w-full max-w-2xl -translate-x-1/2">
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
          {/* Search Input */}
          <div className="border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div className="flex items-center gap-3">
              <Search className="h-5 w-5 text-zinc-400" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search documents... (press ESC to close)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 bg-transparent text-base outline-none placeholder-zinc-400 dark:placeholder-zinc-500 dark:text-zinc-50"
              />
              <button
                onClick={onClose}
                className="text-zinc-400 transition-colors hover:text-zinc-600 dark:hover:text-zinc-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Results List */}
          <div className="max-h-96 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-8 text-center text-sm text-zinc-500">
                Loading documents...
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="px-4 py-8">
                <p className="text-center text-sm text-zinc-500">
                  {searchQuery
                    ? 'No documents found matching your search'
                    : 'No documents yet'}
                </p>
                {searchQuery && (
                  <p className="mt-2 text-center text-xs text-zinc-400">
                    Try searching with different keywords
                  </p>
                )}
              </div>
            ) : (
              <nav className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {filteredDocuments.map((doc, index) => (
                  <button
                    key={doc.id}
                    ref={index === selectedIndex ? selectedItemRef : null}
                    onClick={() => handleSelectDocument(doc.id)}
                    className={`w-full px-4 py-3 text-left transition-colors ${
                      index === selectedIndex
                        ? 'bg-indigo-50 dark:bg-indigo-900/30'
                        : 'hover:bg-zinc-50 dark:hover:bg-zinc-800'
                    }`}
                  >
                    <p className="line-clamp-1 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {doc.title || 'Untitled'}
                    </p>
                    {doc.content && (
                      <p className="line-clamp-1 text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                        {doc.content}
                      </p>
                    )}
                    <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                      {new Date(doc.created_at).toLocaleDateString()}
                    </p>
                  </button>
                ))}
              </nav>
            )}
          </div>

          {/* Footer with keyboard hints */}
          {filteredDocuments.length > 0 && (
            <div className="border-t border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400">
              <div className="flex items-center justify-end gap-4">
                <span className="flex items-center gap-1">
                  <ArrowUp className="h-3 w-3" />
                  <ArrowDown className="h-3 w-3" />
                  navigate
                </span>
                <span>
                  <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono dark:bg-zinc-700">
                    ⏎
                  </kbd>
                  select
                </span>
                <span>
                  <kbd className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs font-mono dark:bg-zinc-700">
                    ESC
                  </kbd>
                  close
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
