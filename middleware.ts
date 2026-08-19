import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  let user = null;
  try {
    const { data } = await supabase.auth.getUser();
    user = data?.user ?? null;
  } catch (err) {
    // Suppress Supabase "Invalid Refresh Token" noise during middleware checks.
    // Treat errors as unauthenticated so middleware redirects to the login route.
    user = null;
  }
  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname === '/login';
  const isProtectedRoute = pathname === '/' || pathname.startsWith('/app');

  if (isProtectedRoute && !user) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isLoginRoute && user) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return response;
}

export const config = {
  // Exclude `/login` from the matcher so middleware does not run for the
  // public login page (helps avoid middleware-related 404s while debugging).
  matcher: ['/', '/app/:path*'],
};
