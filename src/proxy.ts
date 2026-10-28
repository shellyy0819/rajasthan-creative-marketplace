import { NextResponse, type NextRequest } from 'next/server';
import { hostConfig, routeFor } from '@/lib/hosts';

/** Splits one deployment into the public shop and the dashboard by hostname (see lib/hosts.ts). Not an authorisation layer. */
export function proxy(req: NextRequest) {
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  const { pathname, search } = req.nextUrl;
  const d = routeFor(host, pathname, hostConfig(), search);
  switch (d.action) {
    case 'rewrite': return NextResponse.rewrite(new URL(d.to, req.url));
    case 'redirect': return NextResponse.redirect(new URL(d.to, req.url), d.status);
    case 'notfound': return NextResponse.rewrite(new URL('/_not-found-dashboard', req.url)); // no such route: renders the 404 page with status 404
    default: return NextResponse.next();
  }
}

export const config = { matcher: ['/((?!_next/static|_next/image).*)'] };
