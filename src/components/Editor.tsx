'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, ChevronRight, Code, Heading1, Italic } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/supabase';

type Document = Database['public']['Tables']['documents']['Row'];

interface EditorProps {
  documentId: string;
  onSelectDocument?: (documentId: string) => void;
}

export default function Editor({ documentId, onSelectDocument }: EditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [document, setDocument] = useState<Document | null>(null);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toolbarVisible, setToolbarVisible] = useState(false);
  const [toolbarPosition, setToolbarPosition] = useState({ top: 0, left: 0 });
  const [hasLoadedInitialDocument, setHasLoadedInitialDocument] = useState(false);

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

        if (fetchError) {
          throw fetchError;
        }

        if (isCancelled) return;

        setDocument(data);
        setTitle(data.title || '');
        setContent(data.content || '');
        setHasLoadedInitialDocument(true);

        const { data: workspaceDocuments, error: workspaceError } = await supabase
          .from('documents')
          .select('*')
          .eq('workspace_id', data.workspace_id)
          .order('created_at', { ascending: true });

        if (workspaceError) {
          throw workspaceError;
        }

        if (!isCancelled) {
          setDocuments((workspaceDocuments as Document[]) || []);
        }
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

  const updateToolbarPosition = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const hasSelection = selectionStart !== selectionEnd;

    setToolbarVisible(hasSelection);

    if (!hasSelection) return;

    const textBeforeSelection = textarea.value.slice(0, selectionStart);
    const lineCount = textBeforeSelection.split('\n').length - 1;
    const lastLine = textBeforeSelection.split('\n').at(-1) || '';
    const estimatedLeft = Math.min(Math.max(24, 24 + lastLine.length * 7.2), textarea.clientWidth - 180);
    const estimatedTop = 12 + lineCount * 24;

    setToolbarPosition({
      top: estimatedTop,
      left: estimatedLeft,
    });
  };

  const applyFormat = (
    prefix: string,
    suffix = prefix,
    placeholder = 'text',
    isBlock = false
  ) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.slice(start, end) || placeholder;
    const nextValue =
      textarea.value.slice(0, start) +
      (isBlock ? `${prefix}${selectedText}${suffix}` : `${prefix}${selectedText}${suffix}`) +
      textarea.value.slice(end);

    textarea.setRangeText(
      isBlock ? `${prefix}${selectedText}${suffix}` : `${prefix}${selectedText}${suffix}`,
      start,
      end,
      'end'
    );

    setContent(textarea.value);
    setToolbarVisible(false);
    textarea.focus();
    requestAnimationFrame(updateToolbarPosition);
  };

  const handleKeyboardShortcut = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const isModifier = event.metaKey || event.ctrlKey;
    const key = event.key.toLowerCase();

    if (isModifier && key === 'b') {
      event.preventDefault();
      applyFormat('**', '**', 'bold');
      return;
    }

    if (isModifier && key === 'i') {
      event.preventDefault();
      applyFormat('*', '*', 'italic');
      return;
    }

    if (isModifier && event.shiftKey && key === 'k') {
      event.preventDefault();
      applyFormat('```\n', '\n```', 'code', true);
      return;
    }

    if (isModifier && event.altKey && event.key === '1') {
      event.preventDefault();
      applyFormat('## ', '', 'Heading');
    }
  };

  useEffect(() => {
    if (!document) return;

    const hasChanges =
      title !== (document.title || '') || content !== (document.content || '');

    if (!hasChanges) return;

    const timer = window.setTimeout(async () => {
      setIsSaving(true);

      try {
        const { error: updateError } = await supabase
          .from('documents')
          .update({
            title: title.trim() || 'Untitled',
            content,
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
                title: title.trim() || 'Untitled',
                content,
                updated_at: new Date().toISOString(),
              }
            : current
        );
      } catch (err) {
        console.error('Failed to save document:', err);
      } finally {
        setIsSaving(false);
      }
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [title, content, documentId, document]);

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
      </header>

      <div className="relative flex-1 overflow-auto">
        <div className="mx-auto max-w-3xl px-8 py-6">
          <div className="relative">
            <div
              className={[
                'absolute z-10 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-sm transition-opacity duration-150 dark:border-zinc-700 dark:bg-zinc-900',
                toolbarVisible ? 'opacity-100' : 'pointer-events-none opacity-0',
              ].join(' ')}
              style={{
                top: toolbarPosition.top,
                left: toolbarPosition.left,
              }}
            >
              <button
                type="button"
                onClick={() => applyFormat('**', '**', 'bold')}
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="Bold"
              >
                <Bold className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat('*', '*', 'italic')}
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="Italic"
              >
                <Italic className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat('```\n', '\n```', 'code', true)}
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="Code block"
              >
                <Code className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => applyFormat('## ', '', 'Heading')}
                className="flex h-7 w-7 items-center justify-center rounded text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                aria-label="Heading"
              >
                <Heading1 className="h-3.5 w-3.5" />
              </button>
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onSelect={updateToolbarPosition}
              onKeyUp={updateToolbarPosition}
              onMouseUp={updateToolbarPosition}
              onKeyDown={handleKeyboardShortcut}
              placeholder="Start typing..."
              className="h-[calc(100vh-180px)] w-full resize-none bg-transparent text-base leading-7 text-zinc-700 placeholder:text-zinc-400 outline-none focus:outline-none dark:text-zinc-200 dark:placeholder:text-zinc-600"
              aria-label="Document content"
            />
          </div>
        </div>
      </div>
    </main>
  );
}
