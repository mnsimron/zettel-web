'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Loader2, ChevronRight, ChevronDown, FileText, LogOut } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Document = Database['public']['Tables']['documents']['Row'];

type DocumentNode = Document & {
  children: DocumentNode[];
};

interface SidebarProps {
  onNewDocument: () => void;
  onSelectDocument: (documentId: string) => void;
  currentDocumentId?: string;
  workspaceId: string;
  userId?: string;
  userEmail?: string | null;
  onSignOut?: () => void;
}

function buildDocumentTree(documents: Document[]): DocumentNode[] {
  const map = new Map<string, DocumentNode>();
  const roots: DocumentNode[] = [];

  documents.forEach((doc) => {
    map.set(doc.id, { ...doc, children: [] });
  });

  documents.forEach((doc) => {
    const node = map.get(doc.id);

    if (!node) return;

    if (doc.parent_id && map.has(doc.parent_id)) {
      const parent = map.get(doc.parent_id);
      if (parent) {
        parent.children.push(node);
      }
    } else {
      roots.push(node);
    }
  });

  return roots.sort((a, b) => {
    const aDate = new Date(a.created_at).getTime();
    const bDate = new Date(b.created_at).getTime();
    return bDate - aDate;
  });
}

export default function Sidebar({
  onNewDocument,
  onSelectDocument,
  currentDocumentId,
  workspaceId,
  userId,
  userEmail,
  onSignOut,
}: SidebarProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tree = useMemo(() => buildDocumentTree(documents), [documents]);

  useEffect(() => {
    const fetchDocuments = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('documents')
          .select()
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        setDocuments(data || []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load documents';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();

    const channel = supabase
      .channel(`public:documents:${workspaceId}`)
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
            setDocuments((prev) => {
              if (prev.some((doc) => doc.id === newDoc.id)) return prev;
              return [newDoc, ...prev];
            });
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

  const toggleNode = (docId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const renderDocumentNode = (doc: DocumentNode, depth = 0) => {
    const hasChildren = doc.children.length > 0;
    const isExpanded = expandedNodes[doc.id] ?? true;

    return (
      <div key={doc.id} className="space-y-1">
        <div
          className="flex items-center gap-1"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNode(doc.id)}
              className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label={isExpanded ? 'Collapse document' : 'Expand document'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="h-6 w-6" />
          )}

          <button
            type="button"
            onClick={() => onSelectDocument(doc.id)}
            className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
              currentDocumentId === doc.id
                ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100'
                : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1 truncate font-medium">{doc.title || 'Untitled'}</span>
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {doc.children.map((child) => renderDocumentNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Zettel
        </h1>
      </div>

      <div className="p-4">
        <button
          onClick={onNewDocument}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <Plus className="h-4 w-4" />
          New Page
        </button>
      </div>

      <div className="px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
          Documents
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
          </div>
        ) : error ? (
          <div className="px-3 py-2">
            <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
          </div>
        ) : tree.length === 0 ? (
          <div className="px-3 py-2">
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No documents yet. Create one to get started!
            </p>
          </div>
        ) : (
          <nav className="space-y-1 px-2 py-2">
            {tree.map((doc) => renderDocumentNode(doc))}
          </nav>
        )}
      </div>

      <div className="border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-xs font-medium text-white">
              {(userEmail ?? 'U').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {userEmail ?? 'Signed in user'}
              </div>
              <div className="truncate text-[10px] text-zinc-500 dark:text-zinc-400">
                {userId ? userId.slice(0, 8) : 'No user'}
              </div>
            </div>
          </div>
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="rounded-md border border-zinc-200 p-1.5 text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-700 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label="Sign out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
