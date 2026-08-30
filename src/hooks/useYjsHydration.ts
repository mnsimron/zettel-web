import { useRef, useEffect } from 'react';

interface UseYjsHydrationOptions {
  documentId: string;
}

export function useYjsHydration({ documentId }: UseYjsHydrationOptions) {
  const isHydratedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    // Reset hydration state on documentId change
    isHydratedRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [documentId]);

  const markHydrationStart = () => {
    isHydratedRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // Force complete hydration after 5 seconds to prevent indefinite blocking
    timeoutRef.current = window.setTimeout(() => {
      console.warn('⏱️  [HYDRATION] Timeout - forcing completion after 5s');
      isHydratedRef.current = true;
      timeoutRef.current = null;
    }, 5000);
  };

  const markHydrationComplete = () => {
    isHydratedRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const isReadyForRemoteUpdates = () => isHydratedRef.current;

  const reset = () => {
    isHydratedRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  return {
    markHydrationStart,
    markHydrationComplete,
    isReadyForRemoteUpdates,
    reset,
  };
}
