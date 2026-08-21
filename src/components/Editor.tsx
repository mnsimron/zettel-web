'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { toast } from 'sonner';
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Subscript } from '@tiptap/extension-subscript';
import { Superscript } from '@tiptap/extension-superscript';
import { TextStyle } from '@tiptap/extension-text-style';
import { Color } from '@tiptap/extension-color';
import { Highlight } from '@tiptap/extension-highlight';
import { TextAlign } from '@tiptap/extension-text-align';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronRight,
  Code,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Heading4,
  Highlighter,
  ImageIcon,
  Italic,
  List,
  ListOrdered,
  ListTodo,
  Palette,
  Quote,
  Share2,
  Strikethrough,
  Users,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Type,
  Underline as UnderlineIcon,
  type LucideIcon,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';
import ShareDocumentModal from '@/components/ShareDocumentModal';

type DocRow = Database['public']['Tables']['documents']['Row'];
type AccessibleDoc = Database['public']['Tables']['documents_accessible']['Row'];

interface EditorProps {
  documentId: string;
  onSelectDocument?: (documentId: string) => void;
}

function ToolbarButton({
  onClick,
  active,
  label,
  icon: Icon,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'flex h-7 w-7 items-center justify-center rounded text-zinc-200 transition-colors hover:bg-zinc-800',
        active ? 'bg-zinc-800 text-white' : '',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

function FloatingToolbarButton({
  onClick,
  active,
  label,
  icon: Icon,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  icon: LucideIcon;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={[
        'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800',
        active ? 'bg-zinc-800 text-white' : '',
      ].join(' ')}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
    </button>
  );
}

export default function Editor({ documentId, onSelectDocument }: EditorProps) {
  const [document, setDocument] = useState<DocRow | null>(null);
  const [documents, setDocuments] = useState<AccessibleDoc[]>([]);
  const [title, setTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
  const [alignmentMenuOpen, setAlignmentMenuOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [collaborators, setCollaborators] = useState<Array<{
    id: string;
    user_id: string;
    role: string;
    profiles?: {
      id: string;
      email: string;
      full_name?: string | null;
    } | null;
  }>>([]);
  const saveTimeoutRef = useRef<number | null>(null);

  const insertImageFromUrl = (url: string) => {
    if (!editor || !url.trim()) return;
    editor.chain().focus().setImage({ src: url.trim(), alt: 'Inserted image' }).run();
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Subscript,
      Superscript,
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
      Placeholder.configure({
        placeholder: "Press '/' for commands or start typing...",
      }),
    ],
    editorProps: {
      attributes: {
        class:
          'prose prose-zinc max-w-none min-h-[calc(100vh-220px)] w-full bg-transparent text-[15px] leading-7 text-zinc-800 outline-none focus:outline-none dark:prose-invert dark:text-zinc-200 prose-headings:font-semibold prose-headings:tracking-tight prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-1 prose-blockquote:my-3 prose-code:before:content-none prose-code:after:content-none prose-img:my-4 prose-img:max-w-full prose-img:rounded-xl prose-img:border prose-img:border-zinc-200/80 prose-img:shadow-sm [&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0 [&_ul[data-type=taskList]_li]:list-none [&_ul[data-type=taskList]_li]:pl-0 [&_ul[data-type=taskList]_li>label]:mr-2',
      },
      handlePaste: (view, event) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find((item) => item.type.startsWith('image/'));

        if (!imageItem) {
          return false;
        }

        const file = imageItem.getAsFile();
        if (!file) {
          return false;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const src = String(reader.result || '');
          if (!src) return;
          editor?.chain().focus().setImage({ src, alt: 'Pasted image' }).run();
        };
        reader.readAsDataURL(file);

        return true;
      },
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []);
        const imageFile = files.find((file) => file.type.startsWith('image/'));

        if (!imageFile) {
          return false;
        }

        const reader = new FileReader();
        reader.onload = () => {
          const src = String(reader.result || '');
          if (!src) return;
          editor?.chain().focus().setImage({ src, alt: 'Dropped image' }).run();
        };
        reader.readAsDataURL(imageFile);

        return true;
      },
    },
    content: document?.content ?? '',
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();

      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }

      setIsSaving(true);

      saveTimeoutRef.current = window.setTimeout(async () => {
        const loadingId = toast.loading('Saving document...');

        try {
          const { error: updateError } = await supabase
            .from('documents')
            .update({
              content: html,
              updated_at: new Date().toISOString(),
            })
            .eq('id', documentId);

          if (updateError) {
            throw updateError;
          }

          setDocument((current) =>
            current
              ? {
                  ...current,
                  content: html,
                  updated_at: new Date().toISOString(),
                }
              : current
          );

          toast.success('Document saved.', { id: loadingId });
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Failed to save document content.';
          toast.error(message, { id: loadingId });
        } finally {
          setIsSaving(false);
        }
      }, 1000);
    },
  });

  const fetchCollaborators = async (targetDocumentId: string) => {
    const { data, error: collaboratorsError } = await supabase
      .from('document_collaborators')
      .select(`
        id,
        user_id,
        role,
        profiles!document_collaborators_user_id_fkey (
          id,
          email,
          full_name
        )
      `)
      .eq('document_id', targetDocumentId)
      .order('created_at', { ascending: false });

    if (collaboratorsError) {
      throw collaboratorsError;
    }

    setCollaborators((data ?? []) as Array<{
      id: string;
      user_id: string;
      role: string;
      profiles?: {
        id: string;
        email: string;
        full_name?: string | null;
      } | null;
    }>);
  };

  useEffect(() => {
    let isCancelled = false;

    const fetchDocument = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const { data, error: fetchError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId)
          .single();

        if (fetchError) throw fetchError;

        if (isCancelled) return;

        setDocument(data as DocRow);
        setTitle(data.title || '');

        // Include documents in the same workspace or documents shared with the current user
        const user = (await supabase.auth.getUser()).data.user;
        const userId = user?.id ?? currentUserId;

        console.log('Editor.fetchWorkspaceDocuments input', { workspace_id: data.workspace_id, userId });

        let workspaceQuery = supabase.from('documents_accessible').select('*').order('created_at', { ascending: true });
        if (userId) {
          const orFilter = `workspace_id.eq.${data.workspace_id},collaborator_ids.cs.{${userId}}`;
          workspaceQuery = workspaceQuery.or(orFilter);
        } else {
          workspaceQuery = workspaceQuery.eq('workspace_id', data.workspace_id);
        }

        const { data: workspaceDocuments, error: workspaceError } = await workspaceQuery;

        console.log('Editor.fetchWorkspaceDocuments result', { workspaceDocuments, workspaceError });

        if (workspaceError) throw workspaceError;

        if (!isCancelled) {
          setDocuments((workspaceDocuments as AccessibleDoc[]) || []);
        }

        await fetchCollaborators(data.id);
      } catch (err) {
        if (isCancelled) return;
        const message = err instanceof Error ? err.message : 'Failed to load document';
        setError(message);
      } finally {
        if (!isCancelled) {
          setIsLoading(false);
        }
      }
    };

    fetchDocument();

    return () => {
      isCancelled = true;
    };
  }, [documentId]);

  useEffect(() => {
    let isMounted = true;

    const loadUser = async () => {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) {
        toast.error(error.message || 'Unable to load current user.');
        return;
      }

      if (isMounted) {
        setCurrentUserId(user?.id ?? null);
      }
    };

    void loadUser();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!editor || !document) return;

    const html = document.content ?? '';
    if (editor.getHTML() !== html) {
      editor.commands.setContent(html, { emitUpdate: false });
    }
  }, [editor, document]);

  useEffect(() => {
    if (!document) return;

    const hasChanged = title !== (document.title || '');

    if (!hasChanged) return;

    const timer = window.setTimeout(async () => {
      const loadingId = toast.loading('Saving title...');

      try {
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            title: title.trim() || 'Untitled',
            updated_at: new Date().toISOString(),
          })
          .eq('id', documentId);

        if (updateError) throw updateError;

        setDocument((current) =>
          current
            ? {
                ...current,
                title: title.trim() || 'Untitled',
                updated_at: new Date().toISOString(),
              }
            : current
        );

        toast.success('Title updated.', { id: loadingId });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to save title.';
        toast.error(message, { id: loadingId });
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [documentId, title, document]);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        window.clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

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
            <nav
              aria-label="Breadcrumb"
              className="mb-3 flex items-center gap-1 overflow-hidden text-xs text-zinc-500 dark:text-zinc-400"
            >
              {breadcrumbs.length > 0 ? (
                breadcrumbs.map((item, index) => (
                  <div key={item.id} className="flex items-center gap-1 truncate">
                    {index > 0 && (
                      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-zinc-400 dark:text-zinc-500" />
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (item.id !== documentId && onSelectDocument) {
                          onSelectDocument(item.id);
                        }
                      }}
                      className={[
                        'truncate rounded px-1 py-0.5 transition-colors',
                        item.id === documentId
                          ? 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200'
                          : 'hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200',
                      ].join(' ')}
                    >
                      {item.title || 'Untitled'}
                    </button>
                  </div>
                ))
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400">Document</span>
              )}
            </nav>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Untitled"
              className="w-full border-none bg-transparent text-2xl font-semibold tracking-tight text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50 dark:placeholder:text-zinc-600"
              aria-label="Document title"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
              <Users className="h-3.5 w-3.5" />
              {collaborators.length > 0 ? (
                <div className="flex items-center gap-1.5">
                  <span>Already shared</span>
                  <div className="flex items-center gap-1">
                    {collaborators.slice(0, 2).map((collaborator) => (
                      <span
                        key={collaborator.id}
                        className="rounded-full bg-white px-1.5 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                      >
                        {collaborator.profiles?.full_name || collaborator.profiles?.email || 'Shared user'}
                      </span>
                    ))}
                    {collaborators.length > 2 && (
                      <span className="text-[10px] text-zinc-500 dark:text-zinc-400">
                        +{collaborators.length - 2} more
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <span>Not shared yet</span>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-md border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-medium text-indigo-700 transition-colors hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-200 dark:hover:bg-indigo-900/60"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </button>

            <span
              aria-live="polite"
              className={[
                'inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-wide uppercase',
                isSaving
                  ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300',
              ].join(' ')}
            >
              <span
                className={[
                  'h-1.5 w-1.5 rounded-full',
                  isSaving ? 'bg-amber-500' : 'bg-emerald-500',
                ].join(' ')}
              />
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
              onSuccess={() => void fetchCollaborators(document.id)}
              documentId={document.id}
              documentName={document.title || 'Untitled Document'}
              currentUserId={currentUserId ?? undefined}
            />
          )}

          {editor && (
            <>
              <FloatingMenu
                editor={editor}
                shouldShow={({ state }) => {
                  const { selection } = state;
                  return selection.empty && selection.$anchor.parent.textContent.length === 0;
                }}
                options={{
                  placement: 'top-start',
                  offset: { mainAxis: 12 },
                  strategy: 'absolute',
                }}
                className="flex max-w-[min(560px,calc(100vw-3rem))] flex-wrap items-center gap-1.5 rounded-lg border border-zinc-700 bg-zinc-900 p-1.5 shadow-lg shadow-zinc-950/30"
              >
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setHeadingMenuOpen((current) => !current);
                      setAlignmentMenuOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                  >
                    <Type className="h-3.5 w-3.5" />
                    <span>Heading</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>

                  {headingMenuOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-40 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-zinc-950/30">
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setParagraph().run();
                          setHeadingMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <Type className="h-3.5 w-3.5" />
                        Paragraph
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().toggleHeading({ level: 1 }).run();
                          setHeadingMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <Heading1 className="h-3.5 w-3.5" />
                        H1
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().toggleHeading({ level: 2 }).run();
                          setHeadingMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <Heading2 className="h-3.5 w-3.5" />
                        H2
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().toggleHeading({ level: 3 }).run();
                          setHeadingMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <Heading3 className="h-3.5 w-3.5" />
                        H3
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().toggleHeading({ level: 4 }).run();
                          setHeadingMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <Heading4 className="h-3.5 w-3.5" />
                        H4
                      </button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => {
                      setAlignmentMenuOpen((current) => !current);
                      setHeadingMenuOpen(false);
                    }}
                    className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                  >
                    <AlignLeft className="h-3.5 w-3.5" />
                    <span>Alignment</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </button>

                  {alignmentMenuOpen && (
                    <div className="absolute left-0 top-full z-50 mt-2 w-40 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-xl shadow-zinc-950/30">
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setTextAlign('left').run();
                          setAlignmentMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <AlignLeft className="h-3.5 w-3.5" />
                        Left
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setTextAlign('center').run();
                          setAlignmentMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <AlignCenter className="h-3.5 w-3.5" />
                        Center
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setTextAlign('right').run();
                          setAlignmentMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <AlignRight className="h-3.5 w-3.5" />
                        Right
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          editor.chain().focus().setTextAlign('justify').run();
                          setAlignmentMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-zinc-200 transition-colors hover:bg-zinc-800"
                      >
                        <AlignJustify className="h-3.5 w-3.5" />
                        Justify
                      </button>
                    </div>
                  )}
                </div>

                <FloatingToolbarButton
                  label="List"
                  icon={List}
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                />
                <FloatingToolbarButton
                  label="Ordered"
                  icon={ListOrdered}
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                />
                <FloatingToolbarButton
                  label="Tasks"
                  icon={ListTodo}
                  onClick={() => editor.chain().focus().toggleTaskList().run()}
                />
                <FloatingToolbarButton
                  label="Quote"
                  icon={Quote}
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                />
                <FloatingToolbarButton
                  label="Code"
                  icon={Code}
                  onClick={() => editor.chain().focus().toggleCodeBlock().run()}
                />
                <button
                  type="button"
                  onClick={() => {
                    const url = window.prompt('Image URL');
                    if (!url) return;
                    insertImageFromUrl(url);
                  }}
                  className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  <span>Insert Image</span>
                </button>
              </FloatingMenu>

              <BubbleMenu
                editor={editor}
                options={{
                  placement: 'top-start',
                  offset: { mainAxis: 10 },
                  strategy: 'absolute',
                }}
                className="flex items-center gap-1 rounded-lg border border-zinc-700 bg-zinc-900 p-1 shadow-lg shadow-zinc-950/30"
              >
                <ToolbarButton
                  label="Bold"
                  icon={Bold}
                  active={editor.isActive('bold')}
                  onClick={() => editor.chain().focus().toggleBold().run()}
                />
                <ToolbarButton
                  label="Italic"
                  icon={Italic}
                  active={editor.isActive('italic')}
                  onClick={() => editor.chain().focus().toggleItalic().run()}
                />
                <ToolbarButton
                  label="Strikethrough"
                  icon={Strikethrough}
                  active={editor.isActive('strike')}
                  onClick={() => editor.chain().focus().toggleStrike().run()}
                />
                <ToolbarButton
                  label="Underline"
                  icon={UnderlineIcon}
                  active={editor.isActive('underline')}
                  onClick={() => editor.chain().focus().toggleUnderline().run()}
                />
                <ToolbarButton
                  label="Subscript"
                  icon={SubscriptIcon}
                  active={editor.isActive('subscript')}
                  onClick={() => editor.chain().focus().toggleSubscript().run()}
                />
                <ToolbarButton
                  label="Superscript"
                  icon={SuperscriptIcon}
                  active={editor.isActive('superscript')}
                  onClick={() => editor.chain().focus().toggleSuperscript().run()}
                />
                <button
                  type="button"
                  aria-label="Highlight"
                  title="Highlight"
                  onClick={() => editor.chain().focus().toggleHighlight({ color: '#fef08a' }).run()}
                  className={[
                    'flex h-7 w-7 items-center justify-center rounded text-zinc-200 transition-colors hover:bg-zinc-800',
                    editor.isActive('highlight') ? 'bg-zinc-800 text-white' : '',
                  ].join(' ')}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                </button>

                <label
                  aria-label="Text color"
                  title="Text color"
                  className="flex h-7 w-7 cursor-pointer items-center justify-center rounded text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  <Palette className="h-3.5 w-3.5" />
                  <input
                    type="color"
                    className="sr-only"
                    value={editor.getAttributes('textStyle').color || '#18181b'}
                    onChange={(event) => {
                      editor.chain().focus().setColor(event.target.value).run();
                    }}
                  />
                </label>

                <button
                  type="button"
                  aria-label="Clear formatting"
                  title="Clear formatting"
                  onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()}
                  className="flex h-7 w-7 items-center justify-center rounded text-zinc-200 transition-colors hover:bg-zinc-800"
                >
                  <Eraser className="h-3.5 w-3.5" />
                </button>
              </BubbleMenu>
            </>
          )}

          <EditorContent editor={editor} />
        </div>
      </div>
    </main>
  );
}