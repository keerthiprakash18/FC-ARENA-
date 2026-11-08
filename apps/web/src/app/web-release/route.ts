export const dynamic = 'force-dynamic';

/** Frontend build identity, without a session or database request. */
export function GET() {
  return Response.json({ release: process.env.NEXT_PUBLIC_FC_ARENA_RELEASE_SHA ?? 'unknown' }, {
    headers: { 'Cache-Control': 'no-store, max-age=0', 'CDN-Cache-Control': 'no-store' },
  });
}
