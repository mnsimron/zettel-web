'use client';

import { useState, useEffect } from 'react';
import { LogOut } from 'lucide-react';
import Sidebar from '@/components/Sidebar';
import Editor from '@/components/Editor';
import NewDocumentModal from '@/components/NewDocumentModal';
import CommandPalette from '@/components/CommandPalette';
import { getDefaultWorkspaceId } from '@/lib/workspace';
import { supabase } from '@/lib/supabase';

export default function Home() {
  const [currentDocumentId, setCurrentDocumentId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [newDocumentParentId, setNewDocumentParentId] = useState<string | null>(null);
  const [documentRefreshVersion, setDocumentRefreshVersion] = useState(0);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(true);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadUserWorkspace = async () => {
      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setWorkspaceError('Your session expired. Please sign in again.');
          return;
        }

        if (!isMounted) return;

        setUserId(user.id);
        setUserEmail(user.email ?? null);

        const id = await getDefaultWorkspaceId(user.id);
        setWorkspaceId(id);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to load workspace';
        setWorkspaceError(message);
        console.error('Workspace error:', error);
      } finally {
        if (isMounted) {
          setIsLoadingWorkspace(false);
        }
      }
    };

    loadUserWorkspace();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      setUserId(nextUser?.id ?? null);
      setUserEmail(nextUser?.email ?? null);

      if (!nextUser) {
        setWorkspaceId(null);
        setWorkspaceError('Your session expired. Please sign in again.');
      }
    });

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const handleOpenModal = (parentId?: string) => {
    setNewDocumentParentId(parentId ?? null);
    setIsModalOpen(true);
  };
  const handleCloseModal = () => {
    setIsModalOpen(false);
    setNewDocumentParentId(null);
  };
  const handleDocumentCreated = (documentId: string) => {
    setCurrentDocumentId(documentId);
    setDocumentRefreshVersion((prev) => prev + 1);
  };
  const handleSelectDocument = (documentId: string) => setCurrentDocumentId(documentId);
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = '/login';
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (isLoadingWorkspace) {
    return (
      <div suppressHydrationWarning className="flex h-screen items-center justify-center bg-white dark:bg-black">
        <div suppressHydrationWarning className="text-center">
          <div suppressHydrationWarning className="mb-3 inline-block">
            <div suppressHydrationWarning className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-indigo-600 dark:border-zinc-700 dark:border-t-indigo-500" />
          </div>
          <p suppressHydrationWarning className="text-sm text-zinc-600 dark:text-zinc-400">
            Initializing your workspace...
          </p>
        </div>
      </div>
    );
  }

  if (workspaceError || !workspaceId || !userId) {
    return (
      <div suppressHydrationWarning className="flex h-screen items-center justify-center bg-white p-4 dark:bg-black">
        <div suppressHydrationWarning className="w-full max-w-xl rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <h1 suppressHydrationWarning className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Unable to load your workspace
          </h1>
          <p suppressHydrationWarning className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-zinc-600 dark:text-zinc-300">
            {workspaceError || 'Your request could not be completed right now.'}
          </p>
          <button
            suppressHydrationWarning
            onClick={() => window.location.href = '/login'}
            className="mt-6 inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div suppressHydrationWarning className="flex h-screen bg-white dark:bg-black">
      <Sidebar
        onNewDocument={handleOpenModal}
        onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
        onSelectDocument={handleSelectDocument}
        currentDocumentId={currentDocumentId || undefined}
        workspaceId={workspaceId || ''}
        userId={userId}
        userEmail={userEmail}
        onSignOut={handleSignOut}
        refreshVersion={documentRefreshVersion}
      />

      {currentDocumentId ? (
        <Editor documentId={currentDocumentId} onSelectDocument={handleSelectDocument} />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
              No document selected
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              Click “New Page” to create your first document
            </p>
          </div>
        </div>
      )}

      <NewDocumentModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onDocumentCreated={handleDocumentCreated}
        onSuccess={() => setDocumentRefreshVersion((prev) => prev + 1)}
        workspaceId={workspaceId}
        userId={userId}
        parentId={newDocumentParentId}
      />

      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        onSelectDocument={handleSelectDocument}
        workspaceId={workspaceId}
      />
    </div>
  );
}
