import { errorResponse, getRoomState, requireUserId } from '@/lib/server';

export const dynamic = 'force-dynamic';

export async function GET(_req: Request, { params }: { params: { roomId: string } }) {
  try {
    const userId = requireUserId();
    return Response.json(await getRoomState(decodeURIComponent(params.roomId), userId));
  } catch (e) {
    return errorResponse(e);
  }
}
