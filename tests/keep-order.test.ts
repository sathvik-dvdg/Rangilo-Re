import { describe, expect, it } from 'vitest';
import { keepOrder } from '@/lib/utils';

const u = (clerk_id: string, last_seen = '') => ({ clerk_id, last_seen });
const ids = (list: { clerk_id: string }[]) => list.map((x) => x.clerk_id);

describe('keepOrder (dashboard refetch)', () => {
  it('uses the server order on first load', () => {
    expect(ids(keepOrder(null, [u('b'), u('a')]))).toEqual(['b', 'a']);
  });

  it('keeps dancers on screen in place when heartbeats reorder the server list', () => {
    const shown = [u('a'), u('b'), u('c'), u('d')];
    expect(ids(keepOrder(shown, [u('c'), u('a'), u('d'), u('b')]))).toEqual(['a', 'b', 'c', 'd']);
  });

  it('puts newcomers first and drops dancers the server no longer returns', () => {
    const shown = [u('a'), u('b'), u('c')];
    expect(ids(keepOrder(shown, [u('c'), u('x'), u('a'), u('y')]))).toEqual(['x', 'y', 'a', 'c']);
  });

  it('takes the fresh data for dancers already shown', () => {
    const [a] = keepOrder([u('a', 'old')], [u('a', 'new')]);
    expect(a.last_seen).toBe('new');
  });
});
