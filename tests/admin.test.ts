// ADMIN-001..003: who may use the admin console, and what its actions do.
// Clerk, Next navigation and the database are mocked; nothing real is deleted or banned.
import { beforeEach, describe, expect, it, vi } from 'vitest';

type ClerkUser = { id: string; publicMetadata?: Record<string, unknown> | null; unsafeMetadata?: Record<string, unknown> } | null;

const mocks = vi.hoisted(() => ({
  user: null as { id: string; publicMetadata?: Record<string, unknown> | null; unsafeMetadata?: Record<string, unknown> } | null,
  ops: [] as string[],
  auditError: null as { code: string; message: string } | null,
  deleteErrorOn: null as string | null,
  banUser: vi.fn(async () => ({})),
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: async () => mocks.user,
  clerkClient: () => ({ users: { banUser: mocks.banUser } }),
}));
// Next signals both by throwing; make each recognisable.
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
  redirect: (to: string) => {
    throw new Error(`REDIRECT ${to}`);
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

// Records every database operation in order, as "table.verb(filter)".
vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        if (mocks.auditError) return { error: mocks.auditError };
        mocks.ops.push(`${table}.insert(${row.action}:${row.target ?? '-'} by ${row.admin_id})`);
        return { error: null };
      },
      delete: () => {
        const done = (filter: string) => {
          mocks.ops.push(`${table}.delete(${filter})`);
          return Promise.resolve({ error: mocks.deleteErrorOn === table ? { code: 'XX000', message: 'boom' } : null });
        };
        return {
          eq: (col: string, value: string) => done(`${col}=${value}`),
          contains: (col: string, value: string[]) => done(`${col}@>${value.join(',')}`),
        };
      },
    }),
  }),
}));

import { isAdminUser, recordAdminAction, requireAdmin } from '@/lib/admin';
import { removeRoom, removeUser } from '@/app/admin/actions';

const ADMIN: ClerkUser = { id: 'user_admin', publicMetadata: { role: 'admin' } };
const DANCER: ClerkUser = { id: 'user_dancer', publicMetadata: {} };
const form = (fields: Record<string, string>) => {
  const data = new FormData();
  for (const [k, v] of Object.entries(fields)) data.set(k, v);
  return data;
};

beforeEach(() => {
  mocks.user = ADMIN;
  mocks.ops = [];
  mocks.auditError = null;
  mocks.deleteErrorOn = null;
  mocks.banUser.mockClear();
});

describe('who is an admin', () => {
  it('is an account whose public metadata has role "admin"', () => {
    expect(isAdminUser({ publicMetadata: { role: 'admin' } })).toBe(true);
    expect(isAdminUser({ publicMetadata: { role: 'admin', team: 'events' } })).toBe(true);
  });

  it('is nobody without that exact role', () => {
    for (const publicMetadata of [undefined, null, {}, { role: 'user' }, { role: 'Admin' }, { role: 'admin ' }, { role: ['admin'] }, { role: true }, { admin: true }, { roles: 'admin' }]) {
      expect(isAdminUser({ publicMetadata: publicMetadata as Record<string, unknown> | null | undefined })).toBe(false);
    }
  });

  // Users can write their own unsafeMetadata from the browser, so it must never grant admin.
  it('ignores a role a user set on themselves in unsafeMetadata', async () => {
    const selfPromoted = { id: 'user_dancer', publicMetadata: {}, unsafeMetadata: { role: 'admin' } };
    expect(isAdminUser(selfPromoted)).toBe(false);
    mocks.user = selfPromoted;
    await expect(requireAdmin()).rejects.toThrow('NOT_FOUND');
  });
});

describe('requireAdmin', () => {
  it('returns the admin', async () => {
    expect(await requireAdmin()).toEqual({ id: 'user_admin' });
  });

  it('sends a signed-out visitor to sign in', async () => {
    mocks.user = null;
    await expect(requireAdmin()).rejects.toThrow('REDIRECT /sign-in');
  });

  it('gives a signed-in non-admin a 404', async () => {
    mocks.user = DANCER;
    await expect(requireAdmin()).rejects.toThrow('NOT_FOUND');
  });
});

describe('admin actions refuse everyone else, before any database or Clerk access', () => {
  it.each([
    ['removeUser', () => removeUser(form({ userId: 'user_target' }))],
    ['removeUser with block', () => removeUser(form({ userId: 'user_target', block: '1' }))],
    ['removeRoom', () => removeRoom(form({ roomId: 'user_a_user_b' }))],
  ])('%s: non-admin gets a 404, signed-out is redirected', async (_name, call) => {
    mocks.user = DANCER;
    await expect(call()).rejects.toThrow('NOT_FOUND');
    mocks.user = null;
    await expect(call()).rejects.toThrow('REDIRECT /sign-in');
    expect(mocks.ops).toEqual([]);
    expect(mocks.banUser).not.toHaveBeenCalled();
  });
});

describe('removeUser', () => {
  it('records the action first, then deletes rooms, reveals and the profile; the payment ledger is untouched', async () => {
    await expect(removeUser(form({ userId: 'user_target' }))).rejects.toThrow('REDIRECT /admin/users?notice=removed');
    expect(mocks.ops).toEqual([
      'admin_actions.insert(remove_user:user_target by user_admin)',
      'rooms.delete(participant_ids@>user_target)',
      'reveals.delete(payer_id=user_target)',
      'reveals.delete(target_id=user_target)',
      'users.delete(clerk_id=user_target)',
    ]);
    expect(mocks.ops.some((op) => op.startsWith('payment_orders'))).toBe(false);
    expect(mocks.banUser).not.toHaveBeenCalled();
  });

  it('with block, also bans the Clerk account and records it as a block', async () => {
    await expect(removeUser(form({ userId: 'user_target', block: '1' }))).rejects.toThrow('REDIRECT /admin/users?notice=blocked');
    expect(mocks.ops[0]).toBe('admin_actions.insert(block_user:user_target by user_admin)');
    expect(mocks.banUser).toHaveBeenCalledWith('user_target');
    expect(mocks.ops).toContain('users.delete(clerk_id=user_target)');
  });

  it('does nothing at all if the audit row cannot be written', async () => {
    mocks.auditError = { code: 'PGRST205', message: 'Could not find the table' };
    await expect(removeUser(form({ userId: 'user_target', block: '1' }))).rejects.toThrow('audit log table is missing');
    expect(mocks.ops).toEqual([]);
    expect(mocks.banUser).not.toHaveBeenCalled();
  });

  it('deletes nothing if the Clerk ban fails', async () => {
    mocks.banUser.mockRejectedValueOnce(new Error('clerk down'));
    await expect(removeUser(form({ userId: 'user_target', block: '1' }))).rejects.toThrow('clerk down');
    expect(mocks.ops).toEqual(['admin_actions.insert(block_user:user_target by user_admin)']);
  });

  it('will not remove the admin who is signed in', async () => {
    await expect(removeUser(form({ userId: 'user_admin' }))).rejects.toThrow('REDIRECT /admin/users?notice=self');
    expect(mocks.ops).toEqual([]);
  });

  it.each(['', 'user_a,user_b', 'user_a}', '{user_a', "user_a' or 1=1", 'x'.repeat(121)])('rejects the id %j and changes nothing', async (userId) => {
    await expect(removeUser(form({ userId }))).rejects.toThrow('REDIRECT /admin/users?notice=invalid');
    expect(mocks.ops).toEqual([]);
  });

  it('surfaces a database failure instead of reporting success', async () => {
    mocks.deleteErrorOn = 'users';
    await expect(removeUser(form({ userId: 'user_target' }))).rejects.toThrow('boom');
  });
});

describe('removeRoom', () => {
  it('records the action, then deletes that room only', async () => {
    await expect(removeRoom(form({ roomId: 'user_a_user_b' }))).rejects.toThrow('REDIRECT /admin/rooms?notice=room-removed');
    expect(mocks.ops).toEqual(['admin_actions.insert(remove_room:user_a_user_b by user_admin)', 'rooms.delete(id=user_a_user_b)']);
  });

  it('rejects a malformed room id and changes nothing', async () => {
    await expect(removeRoom(form({ roomId: 'user_a_user_b; drop' }))).rejects.toThrow('REDIRECT /admin/rooms?notice=invalid');
    await expect(removeRoom(form({}))).rejects.toThrow('REDIRECT /admin/rooms?notice=invalid');
    expect(mocks.ops).toEqual([]);
  });

  it('does not delete if the audit row cannot be written', async () => {
    mocks.auditError = { code: '42P01', message: 'relation does not exist' };
    await expect(removeRoom(form({ roomId: 'user_a_user_b' }))).rejects.toThrow('audit log table is missing');
    expect(mocks.ops).toEqual([]);
  });
});

describe('recordAdminAction', () => {
  it('rethrows other database errors rather than letting the action continue', async () => {
    mocks.auditError = { code: '23514', message: 'check constraint' };
    await expect(recordAdminAction('user_admin', 'remove_room', 'x')).rejects.toMatchObject({ code: '23514' });
  });
});
