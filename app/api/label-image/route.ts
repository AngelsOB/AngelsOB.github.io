import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy Firebase Storage label images to avoid CORS issues with Three.js textures.
 * Only allows URLs from the Firebase Storage bucket.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url');

  if (!url || !url.includes('firebasestorage.googleapis.com')) {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
  }

  const res = await fetch(url);
  if (!res.ok) {
    return NextResponse.json({ error: 'Fetch failed' }, { status: res.status });
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
}
