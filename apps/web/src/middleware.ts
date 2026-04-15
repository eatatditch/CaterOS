import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static, _next/image, favicon, and image assets
     * - /embed/* (public iframe-able lead forms)
     * - /widget.js (public hosted widget)
     * - /api/public/* (public API endpoints)
     */
    '/((?!_next/static|_next/image|favicon.ico|embed(?:/|$)|quote(?:/|$)|widget\\.js|api/public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
