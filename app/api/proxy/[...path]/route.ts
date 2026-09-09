import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Disable Next.js body parsing — we stream the raw body directly to the backend.
// Without this, Next.js buffers and size-limits request bodies (bad for uploads/SSE).
export const dynamic = 'force-dynamic';

async function handler(req: NextRequest) {
  const BACKEND_URL = process.env.API_URL;

  const path = req.nextUrl.pathname.replace(/^\/api\/proxy/, '');
  const search = req.nextUrl.search;
  const targetUrl = `${BACKEND_URL}${path}${search}`;

  console.log(`[proxy] → ${req.method} ${targetUrl}`);

  const headers = new Headers(req.headers);
  headers.delete('host');
  // Tell the backend not to compress — Node's fetch auto-decompresses,
  // so forwarding a compressed body causes ERR_CONTENT_DECODING_FAILED
  headers.delete('accept-encoding');
  // Remove content-length to let fetch/undici calculate it correctly
  headers.delete('content-length');

  // Explicitly forward all cookies from the browser to the backend
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  if (allCookies.length > 0) {
    const cookieHeader = allCookies.map(c => `${c.name}=${c.value}`).join('; ');
    headers.set('cookie', cookieHeader);
  }

  // Debug: log if cookies are present for auth-related paths
  if (path.includes('/auths/') || path.includes('/events/') || path.includes('/platforms/')) {
    const hasCookies = !!headers.get('cookie');
    console.log(`[proxy] ${req.method} ${path} - forwarded cookies: ${hasCookies}`);
  }

  let backendRes: Response;
  try {
    // For simple JSON requests, we can read the body to avoid streaming issues
    // For large uploads and SSE, we keep the stream
    const contentType = req.headers.get('content-type') || '';
    let body: any = req.body;

    if (contentType.includes('application/json') && !['GET', 'HEAD'].includes(req.method)) {
      const text = await req.text();
      body = text;
    }

    backendRes = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: ['GET', 'HEAD'].includes(req.method) ? undefined : body,
      // We manually forward cookies via the 'cookie' header in 'headers'
      // so we don't need fetch to try and manage credentials itself.
      duplex: 'half',
    } as RequestInit);
  } catch (err: any) {
    // ECONNRESET / ECONNREFUSED = Render backend is waking up from sleep
    // (free tier spins down after 15 min of inactivity, takes ~30s to wake)
    const code = err?.cause?.code ?? '';
    const isWakeUp =
      code === 'ECONNRESET' ||
      code === 'ECONNREFUSED' ||
      code === 'ETIMEDOUT';

    console.error(
      `[proxy] ${req.method} ${path} → ${isWakeUp ? 'backend waking up' : 'connection error'}: ${code || err?.message}`
    );

    return new NextResponse(
      JSON.stringify({
        statusCode: 503,
        message: isWakeUp
          ? 'Server is starting up — please wait a moment and try again.'
          : 'Could not reach the server.',
      }),
      {
        status: 503,
        headers: { 'content-type': 'application/json' },
      }
    );
  }

  console.log(`[proxy] ← ${req.method} ${targetUrl} → ${backendRes.status}`);

  const responseHeaders = new Headers(backendRes.headers);
  // Remove encoding headers — no longer valid after Node's auto-decompression
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');

  // Fix Set-Cookie headers forwarded from the backend
  const setCookies = responseHeaders.getSetCookie();
  if (setCookies.length > 0) {
    responseHeaders.delete('set-cookie');
    setCookies.forEach(cookie => {
      // Normalise Path to / so the cookie is available to the entire app,
      // not just requests under /api/proxy/
      let newCookie = cookie.replace(/Path=\/[^;]*/g, 'Path=/');
      if (!newCookie.match(/Path=/i)) {
        newCookie += '; Path=/';
      }

      // Strip Domain so the cookie binds to the current host (important on localhost)
      newCookie = newCookie.replace(/;\s*Domain=[^;]+/gi, '');

      // Ensure SameSite=Lax if not already set
      if (!newCookie.match(/SameSite=/i)) {
        newCookie += '; SameSite=Lax';
      }

      responseHeaders.append('set-cookie', newCookie);
    });
  }

  // Log 4xx and 5xx errors so we can see the actual backend message
  if (backendRes.status >= 400) {
    backendRes.clone().text().then(body => {
      console.error(`[proxy] ${req.method} ${path} → ${backendRes.status}`);
      console.error('[proxy] backend error body:', body);
    }).catch(() => {});
  }

  // SSE streams: configure headers for real-time delivery
  const isSSE = responseHeaders.get('content-type')?.includes('text/event-stream');
  if (isSSE) {
    console.log('[proxy] SSE stream detected — configuring for real-time delivery');
    responseHeaders.set('cache-control', 'no-cache');
    responseHeaders.set('x-accel-buffering', 'no');
    responseHeaders.set('connection', 'keep-alive');
  }

  return new NextResponse(backendRes.body, {
    status: backendRes.status,
    headers: responseHeaders,
  });
}

export const GET     = handler;
export const POST    = handler;
export const PUT     = handler;
export const PATCH   = handler;
export const DELETE  = handler;
export const OPTIONS = handler;
