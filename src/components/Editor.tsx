"use client";

import { useEffect, useMemo, useRef, useState } from 'react';
import * as Y from 'yjs';
import { Awareness, applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCaret from '@tiptap/extension-collaboration-caret';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { Share2, Users } from 'lucide-react';
import { toast } from 'sonner';

import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import ShareDocumentModal from '@/components/ShareDocumentModal';

type DocRow = Database['public']['Tables']['documents']['Row'];
type AccessibleDoc = Database['public']['Tables']['documents_accessible']['Row'];

interface EditorProps {
  documentId: string;
  onSelectDocument?: (documentId: string) => void;
  currentUser?: {
    id: string;
    email?: string | null;
    name: string;
    color: string;
  } | null;
}

function stripHtmlToText(html: string) {
  if (!html) return '';
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function uint8ArrayToBase64(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToUint8Array(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export default function Editor({ documentId, onSelectDocument, currentUser }: EditorProps) {
  return <DocumentEditor key={documentId} documentId={documentId} onSelectDocument={onSelectDocument} currentUser={currentUser} />;
}

function DocumentEditor({ documentId, onSelectDocument, currentUser }: EditorProps) {
  const [document, setDocument] = useState<DocRow | null>(null);
  const [documents, setDocuments] = useState<AccessibleDoc[]>([]);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Array<{
    id: string;
    user_id: string;
    role: string;
    profiles?: { id: string; email: string; full_name?: string | null } | null;
  }>>([]);

  const saveTimeoutRef = useRef<number | null>(null);
  const remoteUpdateRef = useRef(false);
  const readyForRemoteRef = useRef(false);
  const documentIdRef = useRef(documentId);
  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const channelRef = useRef<any>(null);
  const editorRef = useRef<any>(null);

  const ydoc = useMemo(() => {
    const nextDoc = new Y.Doc();
    (nextDoc as any).guid = `doc:${documentId}`;
    return nextDoc;
  }, [documentId]);

  useEffect(() => {
    const previousDoc = ydocRef.current;
    const previousAwareness = awarenessRef.current;
    if (previousDoc && previousDoc !== ydoc) {
      try {
        previousAwareness?.destroy();
      } catch {
        // ignore
      }
      try {
        previousDoc.destroy();
      } catch {
        // ignore
      }
    }

    ydocRef.current = ydoc;
    const nextAwareness = new Awareness(ydoc);
    awarenessRef.current = nextAwareness;

    return () => {
      try {
        nextAwareness.setLocalState(null);
      } catch {
        // ignore
      }
      try {
        nextAwareness.destroy();
      } catch {
        // ignore
      }
      try {
        ydoc.destroy();
      } catch {
        // ignore
      }
      ydocRef.current = null;
    };
  }, [ydoc]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({ provider: { awareness: awarenessRef.current ?? undefined } }),
      (StarterKit.configure as any)({ history: false }),
      TextStyle,
      Color.configure({ types: ['textStyle'] }),
      Highlight.configure({ multicolor: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({
        inline: true,
        allowBase64: true,
        HTMLAttributes: {
          class: 'my-4 max-w-full rounded-xl border border-zinc-200/80 shadow-sm',
        },
      }),
      Placeholder.configure({ placeholder: "Press '/' for commands or start typing..." }),
    ],
    content: '',
    onUpdate: ({ editor: currentEditor, transaction }) => {
      if (remoteUpdateRef.current || transaction.getMeta('supabase-remote')) return;
      if (!readyForRemoteRef.current) return;
      const html = currentEditor.getHTML();
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
      setIsSaving(true);
      saveTimeoutRef.current = window.setTimeout(async () => {
        try {
          const { error: updateError } = await supabase
            .from('documents')
            .update({ content: html, updated_at: new Date().toISOString() })
            .eq('id', documentId);

          if (updateError) throw updateError;

          setDocument((current) =>
            current ? { ...current, content: html, updated_at: new Date().toISOString() } : current
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save document';
          toast.error(message);
        } finally {
          setIsSaving(false);
        }
      }, 1500);
    },
  }, [documentId, ydoc]);

  useEffect(() => {
    editorRef.current = editor;
  }, [editor]);

  useEffect(() => {
    documentIdRef.current = documentId;
    readyForRemoteRef.current = false;
    setIsLoading(true);
    setError(null);
    setDocument(null);
    setTitle('');

    const destroyCurrent = () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      try {
        if (editorRef.current) {
          editorRef.current.destroy();
          editorRef.current = null;
        }
      } catch {
        // ignore
      }
      try {
        awarenessRef.current?.setLocalState(null);
        awarenessRef.current?.destroy();
      } catch {
        // ignore
      }
      try {
        ydocRef.current?.destroy();
      } catch {
        // ignore
      }
      awarenessRef.current = null;
      ydocRef.current = null;
    };

    destroyCurrent();

    const tick = window.setTimeout(() => {
      console.log('[LIFECYCLE] destroyed old state; ready to create new document instance', { documentId });
    }, 0);

    return () => {
      clearTimeout(tick);
      destroyCurrent();
    };
  }, [documentId]);

  useEffect(() => {
    if (!documentId) return;

    const channel = supabase.channel(`realtime:yjs:documents:${documentId}`, {
      config: { broadcast: { ack: true } },
    });
    channelRef.current = channel;

    const onLocalUpdate = (update: Uint8Array, origin: unknown) => {
      if (origin === 'supabase-remote' || update.byteLength === 0 || !readyForRemoteRef.current) return;
      void channel.send({
        type: 'broadcast',
        event: 'yjs-update',
        payload: { update: Array.from(update), clientId: ydoc.clientID, documentId },
      });
    };

    const onAwarenessChange = ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
      const changed = [...added, ...updated, ...removed];
      if (changed.length === 0) return;
      const update = encodeAwarenessUpdate(awarenessRef.current!, changed);
      void channel.send({
        type: 'broadcast',
        event: 'yjs-awareness',
        payload: { update: uint8ArrayToBase64(new Uint8Array(update)), clientId: ydoc.clientID, documentId },
      });
    };

    ydoc.on('update', onLocalUpdate);
    awarenessRef.current?.on('update', onAwarenessChange as any);

    channel.on('broadcast', { event: 'yjs-update' }, (msg) => {
      const payload = msg.payload?.payload ?? msg.payload ?? msg;
      const updateArray = payload?.update ?? null;
      const senderDocId = payload?.documentId ?? null;
      const senderClientId = payload?.clientId ?? null;

      if (!updateArray || senderDocId !== documentIdRef.current) return;
      if (senderClientId === ydoc.clientID) return;
      if (!readyForRemoteRef.current) {
        console.warn('[YJS] blocked remote update because hydration is not complete for', documentIdRef.current);
        return;
      }

      remoteUpdateRef.current = true;
      try {
        Y.applyUpdate(ydoc, new Uint8Array(updateArray as number[]), 'supabase-remote');
      } catch (err) {
        console.error('Failed to apply remote Yjs update', err);
      } finally {
        remoteUpdateRef.current = false;
      }
    });

    channel.on('broadcast', { event: 'yjs-awareness' }, (msg) => {
      const payload = msg.payload?.payload ?? msg.payload ?? msg;
      const updateValue = payload?.update ?? null;
      const senderDocId = payload?.documentId ?? null;
      const senderClientId = payload?.clientId ?? null;

      if (!updateValue || senderDocId !== documentIdRef.current) return;
      if (senderClientId === ydoc.clientID) return;
      applyAwarenessUpdate(awarenessRef.current!, base64ToUint8Array(updateValue), null);
    });

    void channel.subscribe();

    return () => {
      ydoc.off('update', onLocalUpdate);
      awarenessRef.current?.off('update', onAwarenessChange as any);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [documentId, ydoc]);

  useEffect(() => {
    if (!documentId) return;

    let cancelled = false;

    const fetchDocument = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (fetchError) throw fetchError;
        if (cancelled) return;

        setDocument(data as DocRow);
        setTitle(data.title || '');

        const user = (await supabase.auth.getUser()).data.user;
        const userId = user?.id ?? currentUserId;

        let workspaceQuery = supabase.from('documents_accessible').select('*').order('created_at', { ascending: true });
        if (userId) {
          const orFilter = `workspace_id.eq.${data.workspace_id},collaborator_ids.cs.{${userId}}`;
          workspaceQuery = workspaceQuery.or(orFilter);
        } else {
          workspaceQuery = workspaceQuery.eq('workspace_id', data.workspace_id);
        }

        const { data: workspaceDocuments, error: workspaceError } = await workspaceQuery;
        if (workspaceError) throw workspaceError;
        if (!cancelled) setDocuments((workspaceDocuments as AccessibleDoc[]) || []);

        const { data: collaboratorData, error: collaboratorError } = await supabase
          .from('document_collaborators')
          .select(`id, user_id, role, profiles!document_collaborators_user_id_fkey (id, email, full_name)`)
          .eq('document_id', documentId)
          .order('created_at', { ascending: false });

        if (collaboratorError) throw collaboratorError;
        if (!cancelled) setCollaborators((collaboratorData ?? []) as any);
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to load document';
          setError(message);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void fetchDocument();

    return () => {
      cancelled = true;
    };
  }, [documentId, currentUserId]);

  useEffect(() => {
    if (!editor || !document || !documentId) return;

    const html = document.content ?? '';
    const expectedText = stripHtmlToText(html);

    const timer = window.setTimeout(() => {
      try {
        console.log('[HYDRATION] replace old content with fresh DB content for', documentId);
        editor.commands.clearContent(false);
        editor.commands.setContent(html, { emitUpdate: false });

        const actualText = stripHtmlToText(editor.getHTML() || '');
        if (actualText !== expectedText) {
          console.error('[HYDRATION] content mismatch after setContent', {
            documentId,
            expectedText,
            actualText,
            html,
          });
        }

        readyForRemoteRef.current = true;
        console.log('[HYDRATION] complete for', documentId);
      } catch (err) {
        console.error('[HYDRATION] failed for', documentId, err);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, [editor, document, documentId]);

  useEffect(() => {
    if (!documentId) return;

    const channel = supabase
      .channel(`public:documents:editor:${documentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` },
        (payload) => {
          const newDoc = payload.new as DocRow;
          if (!newDoc) return;
          setDocument((current) => {
            if (!current) return newDoc;
            const currentTime = new Date(current.updated_at ?? 0).getTime();
            const nextTime = new Date(newDoc.updated_at ?? 0).getTime();
            return nextTime > currentTime ? { ...current, title: newDoc.title, updated_at: newDoc.updated_at } : current;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [documentId]);

  useEffect(() => {
    if (!currentUser) return;
    try {
      awarenessRef.current?.setLocalStateField('user', {
        name: currentUser.name,
        color: currentUser.color,
        email: currentUser.email ?? undefined,
      });
    } catch {
      // ignore
    }
  }, [currentUser]);

  useEffect(() => {
    if (!documentId) return;
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    void loadUser();
  }, [documentId]);

  useEffect(() => {
    if (!document) return;
    const hasChanged = title !== (document.title || '');
    if (!hasChanged) return;
    const timer = window.setTimeout(async () => {
      try {
        const { error: updateError } = await supabase
          .from('documents')
          .update({ title: title.trim() || 'Untitled', updated_at: new Date().toISOString() })
          .eq('id', documentId);
        if (updateError) throw updateError;
        setDocument((current) => (current ? { ...current, title: title.trim() || 'Untitled', updated_at: new Date().toISOString() } : current));
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save title';
        toast.error(message);
      }
    }, 600);
    return () => window.clearTimeout(timer);
  }, [documentId, title, document]);

  const breadcrumbs = useMemo(() => {
    if (!document) return [];
    const map = new Map(documents.map((doc) => [doc.id, doc]));
    const trail: Array<{ id: string; title: string }> = [];
    let currentId: string | null = document.id;
    while (currentId) {
      const current = map.get(currentId);
      if (!current) break;
      trail.unshift({ id: current.id, title: current.title || 'Untitled' });
      currentId = current.parent_id;
    }
    return trail;
  }, [document, documents]);

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading document...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-white dark:bg-black">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  return (
    <main className="flex flex-1 flex-col overflow-hidden bg-white dark:bg-black">
      <header className="border-b border-zinc-200 bg-white/80 px-8 py-4 backdrop-blur-sm dark:border-zinc-800 dark:bg-black/80">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <nav aria-label="Breadcrumb" className="mb-3 flex items-center gap-1 overflow-hidden text-xs text-zinc-500 dark:text-zinc-400">
              {breadcrumbs.length > 0 ? breadcrumbs.map((item, index) => (
                <div key={item.id} className="flex items-center gap-1 truncate">
                  {index > 0 && <span className="text-zinc-400">/</span>}
                  <button
                    type="button"
                    onClick={() => {
                      if (item.id !== documentId && onSelectDocument) onSelectDocument(item.id);
                    }}
                    className="truncate rounded px-1 py-0.5 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    {item.title || 'Untitled'}
                  </button>
                </div>
              )) : <span>Document</span>}
            </nav>

            <input
              type="text"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Untitled"
              className="w-full border-none bg-transparent text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50"
              aria-label="Document title"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <Users className="h-3.5 w-3.5" />
              {collaborators.length > 0 ? <span>{collaborators.length} shared</span> : <span>Not shared yet</span>}
            </div>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>

            <span className={['inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase', isSaving ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'].join(' ')}>
              <span className={['h-1.5 w-1.5 rounded-full', isSaving ? 'bg-amber-500' : 'bg-emerald-500'].join(' ')} />
              {isSaving ? 'Saving' : 'Saved'}
            </span>
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-6">
          {document && (
            <ShareDocumentModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              onSuccess={() => undefined}
              documentId={document.id}
              documentName={document.title || 'Untitled Document'}
              currentUserId={currentUserId ?? undefined}
            />
          )}

          {editor ? <EditorContent editor={editor} /> : <div className="text-sm text-zinc-500">Initializing editor...</div>}
        </div>
      </div>
    </main>
  );
}
