'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Loader2,
  ChevronRight,
  ChevronDown,
  FileText,
  LogOut,
  Search,
  Pencil,
  Trash2,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import { EnableNotificationsButton } from './EnableNotificationsButton';
import { SettingsMenu } from '@/components/SettingsMenu';

type Document = Database['public']['Tables']['documents_accessible']['Row'];

type DocumentNode = Document & {
  children: DocumentNode[];
};

interface SidebarProps {
  onNewDocument: (parentId?: string) => void;
  onOpenCommandPalette: () => void;
  onSelectDocument: (documentId: string) => void;
  currentDocumentId?: string;
  workspaceId: string;
  userId?: string;
  userEmail?: string | null;
  onSignOut?: () => void;
  refreshVersion?: number;
}

type ContextMenuState = {
  x: number;
  y: number;
  documentId: string;
  documentTitle: string;
} | null;

function sortDocumentNodes(nodes: DocumentNode[]) {
  return nodes.sort((a, b) => {
    const aTitle = (a.title || 'Untitled').toLowerCase();
    const bTitle = (b.title || 'Untitled').toLowerCase();

    return aTitle.localeCompare(bTitle) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
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

  const sortedRoots = sortDocumentNodes(roots);
  sortedRoots.forEach((node) => {
    sortDocumentNodes(node.children);
  });

  return sortedRoots;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 600;
const SIDEBAR_WIDTH_KEY = 'zettel_sidebar_width';

export default function Sidebar({
  onNewDocument,
  onOpenCommandPalette,
  onSelectDocument,
  currentDocumentId,
  workspaceId,
  userId,
  userEmail,
  onSignOut,
  refreshVersion = 0,
}: SidebarProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [renameTarget, setRenameTarget] = useState<{ id: string; title: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isResizing, setIsResizing] = useState(false);

  const tree = useMemo(() => buildDocumentTree(documents), [documents]);

  useEffect(() => {
    const storedWidth = window.localStorage.getItem(SIDEBAR_WIDTH_KEY);
    if (storedWidth) {
      const parsed = Number(storedWidth);
      if (!Number.isNaN(parsed)) {
        setSidebarWidth(Math.min(Math.max(parsed, MIN_WIDTH), MAX_WIDTH));
      }
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_WIDTH_KEY, String(sidebarWidth));
  }, [sidebarWidth]);

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (event: MouseEvent) => {
      const nextWidth = Math.min(Math.max(event.clientX, MIN_WIDTH), MAX_WIDTH);
      setSidebarWidth(nextWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.userSelect = '';
    };

    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
    };
  }, [isResizing]);

  const fetchDocuments = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Include documents in the current workspace OR documents shared with the
      // current user (collaborator) which may live in other workspaces.
      const userIdValue = userId ?? (await supabase.auth.getUser()).data.user?.id;

      console.log('fetchDocuments input', { workspaceId, userId: userIdValue });

      let query = supabase.from('documents_accessible').select().neq('is_deleted', true);

      if (userIdValue) {
        // Use an OR filter: workspace OR collaborator membership
        // PostgREST/ Supabase `.or()` accepts a comma-separated list of filters
        const orFilter = `workspace_id.eq.${workspaceId},collaborator_ids.cs.{${userIdValue}}`;
        query = query.or(orFilter).order('title', { ascending: true });
      } else {
        query = query.eq('workspace_id', workspaceId).order('title', { ascending: true });
      }

      const { data, error: fetchError } = await query;

      console.log('fetchDocuments result', { data, fetchError });

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

  useEffect(() => {
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
          const newDoc = payload.new as Document | undefined;
          const oldDoc = payload.old as Document | undefined;

          if (payload.eventType === 'INSERT') {
            if (!newDoc || newDoc.is_deleted) return;
            setDocuments((prev) => {
              if (prev.some((doc) => doc.id === newDoc.id)) return prev;
              return [newDoc, ...prev];
            });
          } else if (payload.eventType === 'UPDATE') {
            if (!newDoc) return;
            setDocuments((prev) => {
              if (newDoc.is_deleted) {
                return prev.filter((doc) => doc.id !== newDoc.id);
              }
              return prev.map((doc) => (doc.id === newDoc.id ? newDoc : doc));
            });
          } else if (payload.eventType === 'DELETE') {
            if (!oldDoc) return;
            setDocuments((prev) => prev.filter((doc) => doc.id !== oldDoc.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId, refreshVersion]);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-context-menu-root="true"]')) {
        setContextMenu(null);
      }
    };

    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const toggleNode = (docId: string) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [docId]: !prev[docId],
    }));
  };

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>, doc: Document) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      documentId: doc.id,
      documentTitle: doc.title || 'Untitled',
    });
  };

  const handleRenameDocument = async () => {
    if (!renameTarget) return;

    const nextTitle = renameValue.trim() || 'Untitled';

    try {
      const updatePromise = (async () => {
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            title: nextTitle,
            updated_at: new Date().toISOString(),
          })
          .eq('id', renameTarget.id);

        if (updateError) throw updateError;
      })();

      await toast.promise(updatePromise, {
        loading: 'Renaming document...',
        success: 'Document renamed successfully.',
        error: (err) => err instanceof Error ? err.message : 'Failed to rename document.',
      });

      setRenameTarget(null);
      setRenameValue('');
      setContextMenu(null);
      await fetchDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename document.';
      toast.error(message);
    }
  };

  const handleSoftDeleteDocument = async (documentId: string) => {
    try {
      const deletePromise = (async () => {
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            is_deleted: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentId);

        if (updateError) throw updateError;
      })();

      await toast.promise(deletePromise, {
        loading: 'Deleting document...',
        success: 'Document deleted.',
        error: (err) => err instanceof Error ? err.message : 'Failed to delete document.',
      });

      setContextMenu(null);
      await fetchDocuments();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete document.';
      toast.error(message);
    }
  };

  const renderDocumentNode = (doc: DocumentNode, depth = 0) => {
    const hasChildren = doc.children.length > 0;
    const isExpanded = expandedNodes[doc.id] ?? true;

    const content = (
      <div className="space-y-1">
        <div
          className="group flex items-center gap-1"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          onContextMenu={(event) => handleContextMenu(event, doc)}
        >
          {hasChildren ? (
            <button
              type="button"
              onClick={() => toggleNode(doc.id)}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-zinc-200 hover:text-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
              aria-label={isExpanded ? 'Collapse document' : 'Expand document'}
            >
              {isExpanded ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
            </button>
          ) : (
            <span className="h-6 w-6 shrink-0" />
          )}

          <button
            type="button"
            onClick={() => onSelectDocument(doc.id)}
            className={`flex w-full min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors ${
              currentDocumentId === doc.id
                ? 'bg-indigo-100 text-indigo-900 dark:bg-indigo-900 dark:text-indigo-100'
                : 'text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800'
            }`}
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-500 dark:text-zinc-400" />
            <span className="min-w-0 flex-1 truncate font-medium">{doc.title || 'Untitled'}</span>
          </button>

          <button
            type="button"
            onClick={() => onNewDocument(doc.id)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-400 opacity-0 transition-opacity duration-150 hover:bg-zinc-200 hover:text-zinc-700 group-hover:opacity-100 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
            aria-label={`Create a child document under ${doc.title || 'Untitled'}`}
            title="Add a child document"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        {hasChildren && isExpanded && (
          <div className="space-y-1">
            {doc.children.map((child) => renderDocumentNode(child, depth + 1))}
          </div>
        )}
      </div>
    );

    return <div key={doc.id}>{content}</div>;
  };

  return (
    <aside
      className={`relative flex h-screen flex-col border-r border-zinc-200 bg-zinc-50 transition-[width] duration-200 ease-out dark:border-zinc-800 dark:bg-zinc-950 ${isResizing ? '' : 'transition-[width]'}`}
      style={{ width: `${sidebarWidth}px` }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        onMouseDown={() => setIsResizing(true)}
        className={`absolute right-0 top-0 z-50 h-full w-1 cursor-col-resize transition-colors ${
          isResizing ? 'bg-indigo-500/60' : 'bg-transparent hover:bg-zinc-300/80 dark:hover:bg-zinc-700/80'
        }`}
        title="Resize sidebar"
      />

      {contextMenu && (
        <div
          data-context-menu-root="true"
          className="fixed z-50 w-40 rounded-md border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-zinc-950/20"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setRenameTarget({
                id: contextMenu.documentId,
                title: contextMenu.documentTitle,
              });
              setRenameValue(contextMenu.documentTitle);
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-zinc-200 transition-colors hover:bg-zinc-800"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setDeleteTarget({
                id: contextMenu.documentId,
                title: contextMenu.documentTitle,
              });
              setContextMenu(null);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm text-red-400 transition-colors hover:bg-zinc-800 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <div className="w-[320px] rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl shadow-zinc-950/30">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-zinc-100">Delete document?</h2>
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close delete dialog"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-sm text-zinc-300">
              Delete <span className="font-medium text-zinc-100">{deleteTarget.title || 'Untitled'}</span>? This will hide it from the sidebar.
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleSoftDeleteDocument(deleteTarget.id);
                  setDeleteTarget(null);
                }}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-500"
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
          <div className="w-[320px] rounded-lg border border-zinc-700 bg-zinc-900 p-4 shadow-xl shadow-zinc-950/30">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-sm font-medium text-zinc-100">Rename document</h2>
              <button
                type="button"
                onClick={() => {
                  setRenameTarget(null);
                  setRenameValue('');
                }}
                className="rounded-md p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-200"
                aria-label="Close rename dialog"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <input
              type="text"
              value={renameValue}
              onChange={(event) => setRenameValue(event.target.value)}
              autoFocus
              className="w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-500 focus:border-zinc-500"
              placeholder="Document title"
            />

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setRenameTarget(null);
                  setRenameValue('');
                }}
                className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleRenameDocument();
                }}
                className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-zinc-200 px-4 py-4 dark:border-zinc-800">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Zettel
        </h1>
      </div>

      <div className="space-y-3 p-4">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="flex w-full items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2.5 text-left text-sm text-zinc-500 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <Search className="h-4 w-4 text-zinc-400 dark:text-zinc-500" />
          <span className="flex-1">Search</span>
          <span className="rounded border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            ⌘K
          </span>
        </button>

        <button
          type="button"
          onClick={() => onNewDocument()}
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
        <div className="flex items-center justify-between gap-3">
          
          {/* Info User */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
              {userEmail ?? 'Signed in user'}
            </div>
            <div className="mt-0.5 truncate text-[10px] text-zinc-500 dark:text-zinc-400">
              {userId ? userId.slice(0, 8) : 'No user'}
            </div>
          </div>

          {/* Actions: notifications + settings */}
          <div className="flex items-center gap-2 shrink-0">
            <EnableNotificationsButton />
            <div className="relative">
              <SettingsMenu />
            </div>
          </div>

        </div>
      </div>
    </aside>
  );
}
