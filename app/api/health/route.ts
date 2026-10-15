export const dynamic = 'force-dynamic';

/**
 * Liveness check for the load balancer: the server process is up and answering.
 * No database call and no auth check, so a slow provider never takes healthy
 * instances out of rotation. Middleware still runs first, so a deployment with
 * invalid Clerk configuration answers 503 here.
 */
export function GET() {
  return Response.json({ ok: true }, { status: 200, headers: { 'Cache-Control': 'no-store' } });
}
