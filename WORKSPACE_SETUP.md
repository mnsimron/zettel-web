# Zettel Workspace Initialization Guide

## Overview

Zettel uses Supabase for backend storage. The application requires proper Row-Level Security (RLS) policies and at least one workspace to function correctly.

## How Workspace Initialization Works

### Startup Flow

```
1. App starts (page.tsx useEffect)
   ↓
2. Call getDefaultWorkspaceId() from workspace.ts
   ↓
3. Query workspaces table for existing workspace
   ├─ Found? → Cache and use it ✅
   └─ Not found? → Create default workspace automatically
   ↓
4. Return workspace UUID
   ↓
5. App is ready to use
```

### Key Features

✅ **Automatic Workspace Creation**: If the `workspaces` table is empty, a "Default Workspace" is automatically created with a valid UUID.

✅ **Caching**: Workspace ID is cached in memory to avoid repeated database queries.

✅ **Error Handling**: Detects RLS permission issues and provides actionable error messages with setup instructions.

✅ **Retry Logic**: Frontend includes a "Retry" button for transient failures.

## Setup Instructions

### Prerequisites

- Supabase project created
- Database tables created (workspaces, documents, profiles, workspace_members)
- Supabase JS client configured in `src/lib/supabase.ts`

### Step 1: Configure RLS Policies

1. Open your Supabase project: https://app.supabase.com/
2. Navigate to **SQL Editor**
3. Click **Create a new query**
4. Open `SETUP_RLS_POLICIES.sql` from your project root
5. Copy ALL the SQL commands
6. Paste into Supabase SQL Editor
7. Click **Run**
8. Wait for all commands to complete (should see ✅ for each)

### Step 2: Verify Setup

After running the SQL:

1. Return to your application
2. Refresh the browser
3. The app should show "Initializing workspace..." briefly
4. A default workspace will be created automatically
5. The app should load successfully

### What RLS Policies Do

The SQL file creates policies that allow the `anon` role (your API key) to:

- **SELECT** (read) from all tables
- **INSERT** (create) new records
- **UPDATE** (modify) existing records
- **DELETE** (remove) records

These policies are essential for the application to function.

## Troubleshooting

### Error: "permission denied for table workspaces" (code 42501)

**Cause**: RLS policies are not configured.

**Fix**:
1. Run the SQL commands from `SETUP_RLS_POLICIES.sql` in your Supabase SQL Editor
2. Refresh your browser
3. Click the "Retry" button

### Error: "Failed to create workspace"

**Possible causes**:
1. RLS policies not configured (see above)
2. Database connection issue
3. Invalid Supabase credentials

**Fix**:
1. Verify your `.env.local` has correct `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
2. Ensure RLS policies are configured
3. Click "Retry" or refresh the page

### Error: "Unable to initialize workspace. Please refresh the page."

**Possible causes**:
1. Network connectivity issue
2. Supabase service temporarily down
3. RLS policies misconfigured

**Fix**:
1. Check your internet connection
2. Refresh the page
3. Click the "Retry" button
4. Verify RLS policies are in place

## Code Overview

### Key Files

- `src/lib/workspace.ts`: Workspace initialization and caching logic
- `src/app/page.tsx`: Main app component with workspace initialization UI
- `SETUP_RLS_POLICIES.sql`: RLS policy configuration SQL
- `.env.local`: Supabase credentials (required)

### getDefaultWorkspaceId()

The main function that handles workspace initialization:

```typescript
// Get or create default workspace
const workspaceId = await getDefaultWorkspaceId();

// Use workspace ID for queries
const { data } = await supabase
  .from('documents')
  .select()
  .eq('workspace_id', workspaceId);
```

### verifyDatabaseSetup()

Helper function to check database configuration:

```typescript
const result = await verifyDatabaseSetup();
console.log(result.message); // Detailed setup status
```

## Development Tips

### Reset Workspace Cache

If you need to clear the cached workspace ID:

```typescript
import { clearWorkspaceCache } from '@/lib/workspace';

clearWorkspaceCache();
// Next call to getDefaultWorkspaceId() will fetch fresh data
```

### Force New Workspace Creation

To test workspace creation logic:

1. Go to Supabase dashboard
2. Open SQL Editor
3. Run: `DELETE FROM public.workspaces;`
4. Refresh your app
5. App will automatically create a new workspace

### Debug Mode

Check browser console for detailed logs:

```
✅ Using existing workspace: <uuid>
✅ Created new default workspace: <uuid>
🔍 Verifying database setup...
```

## Database Schema

### workspaces table

```sql
id          UUID (primary key) - Auto-generated
name        TEXT - Workspace name
created_at  TIMESTAMP - Creation timestamp
```

### documents table

```sql
id            UUID (primary key)
workspace_id  UUID (foreign key → workspaces.id)
title         TEXT
content       TEXT (nullable)
created_at    TIMESTAMP
updated_at    TIMESTAMP
created_by    UUID (nullable, foreign key → profiles.id)
parent_id     UUID (nullable, foreign key → documents.id)
```

## Support

If you encounter issues:

1. Check the error message in the UI
2. Review console logs (F12 → Console)
3. Verify RLS policies in Supabase dashboard
4. Ensure all SQL commands from `SETUP_RLS_POLICIES.sql` were executed
5. Try refreshing the page and clicking "Retry"

For more help, refer to [Supabase Documentation](https://supabase.com/docs)
