import { supabase } from './supabase';

let cachedWorkspaceId: string | null = null;

// Helper to extract error message from any error type
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  
  if (error && typeof error === 'object') {
    const err = error as any;
    // Handle Supabase errors
    if (err.message) return err.message;
    if (err.details) return err.details;
    if (err.hint) return err.hint;
    if (err.code) return `Error code: ${err.code}`;
  }
  
  return String(error || 'Unknown error');
}

export async function getDefaultWorkspaceId(userId?: string): Promise<string> {
  if (!userId) {
    throw new Error('User is not authenticated');
  }

  if (cachedWorkspaceId) {
    return cachedWorkspaceId;
  }

  try {
    // Step 1: Ensure user profile exists (fallback in case trigger didn't fire)
    const { data: existingProfile, error: profileCheckError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single();

    if (profileCheckError && profileCheckError.code !== 'PGRST116') {
      // Ignore "no rows" error, but throw other errors
      throw profileCheckError;
    }

    // If no profile exists, create one
    if (!existingProfile) {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        const { error: profileCreateError } = await supabase
          .from('profiles')
          .insert([
            {
              id: user.id,
              email: user.email || 'unknown@example.com',
              full_name: user.user_metadata?.full_name || null,
            },
          ]);

        // Only throw if it's not a duplicate key error (profile was created elsewhere)
        if (profileCreateError && !profileCreateError.message.includes('duplicate')) {
          throw profileCreateError;
        }
      }
    }

    // Step 2: Check for existing workspace membership
    const { data: memberships, error: membershipError } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1);

    if (membershipError) {
      throw membershipError;
    }

    if (memberships && memberships.length > 0) {
      cachedWorkspaceId = memberships[0].workspace_id;
      return cachedWorkspaceId;
    }

    // Step 3: Create new workspace for this user
    const { data: workspace, error: workspaceError } = await supabase
      .from('workspaces')
      .insert([{ name: 'My Workspace' }])
      .select('id')
      .single();

    if (workspaceError) {
      throw workspaceError;
    }

    if (!workspace?.id) {
      throw new Error('Workspace created but no ID was returned');
    }

    // Step 4: Create workspace membership
    const { error: memberError } = await supabase
      .from('workspace_members')
      .insert([
        {
          workspace_id: workspace.id,
          user_id: userId,
          role: 'owner',
        },
      ]);

    if (memberError) {
      throw memberError;
    }

    cachedWorkspaceId = workspace.id;
    return cachedWorkspaceId;
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    console.error('[Workspace Error]', { originalError: error, message: errorMessage });

    if (errorMessage.includes('42501') || errorMessage.includes('permission denied')) {
      throw new Error(
        'Database access denied. Run SETUP_RLS_POLICIES.sql in Supabase and refresh the page.'
      );
    }

    if (errorMessage.includes('23503') || errorMessage.includes('foreign key')) {
      throw new Error(
        'Profile synchronization failed. Please refresh the page and try again.'
      );
    }

    if (errorMessage.includes('trigger') || errorMessage.includes('function')) {
      throw new Error(
        'Database setup incomplete. Run SETUP_RLS_POLICIES.sql in Supabase SQL Editor.'
      );
    }

    throw new Error(errorMessage || 'Failed to initialize workspace');
  }
}

export function clearWorkspaceCache(): void {
  cachedWorkspaceId = null;
}

export async function verifyDatabaseSetup(): Promise<{
  isValid: boolean;
  workspaceCount: number;
  message: string;
}> {
  try {
    const { data: workspaces, error: workspacesError } = await supabase
      .from('workspaces')
      .select('id')
      .limit(1);

    if (workspacesError) {
      if (workspacesError.code === '42501') {
        return {
          isValid: false,
          workspaceCount: 0,
          message: 'RLS policies not configured. Run SETUP_RLS_POLICIES.sql in Supabase SQL Editor.',
        };
      }

      throw workspacesError;
    }

    return {
      isValid: true,
      workspaceCount: workspaces?.length ?? 0,
      message: `Database setup verified. Found ${workspaces?.length ?? 0} workspace(s).`,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      isValid: false,
      workspaceCount: 0,
      message: `Database verification failed: ${errorMessage}`,
    };
  }
}
