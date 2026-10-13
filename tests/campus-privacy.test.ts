import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  userId: 'user_alice' as string | null,
  supabaseSelect: vi.fn(),
  supabaseFrom: vi.fn(),
  currentUser: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => ({ userId: mocks.userId }),
  currentUser: () => mocks.currentUser(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

vi.mock('@/lib/supabaseAdmin', () => ({
  supabaseAdmin: () => ({
    from: mocks.supabaseFrom,
  }),
}));

import { GET as getUsers } from '@/app/api/users/route';
import { getRevealedContact } from '@/lib/consent';
import { completeOnboarding } from '@/app/(main)/dashboard/actions';

describe('Campus Profiles & Privacy Rules', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userId = 'user_alice';
  });

  describe('GET /api/users Privacy Boundary', () => {
    it('requests public campus fields and never queries or returns private fields', async () => {
      let selectedCols = '';
      mocks.supabaseFrom.mockReturnValue({
        select: (cols: string) => {
          selectedCols = cols;
          return {
            neq: () => ({
              order: () => ({
                limit: () =>
                  Promise.resolve({
                    data: [
                      {
                        clerk_id: 'user_bob',
                        display_name: 'Dandiya_King',
                        gender: 'male',
                        branch: 'CSE',
                        college_year: '3rd Year',
                        vibe_tag: 'Pro Garba Dancer 💃',
                        outfit_color: 'Black mirror-work Kurta',
                        last_seen: new Date().toISOString(),
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        },
      });

      const res = await getUsers();
      expect(res.status).toBe(200);
      const data = await res.json();

      // Verify the query requested public fields
      expect(selectedCols).toContain('vibe_tag');
      expect(selectedCols).toContain('outfit_color');
      expect(selectedCols).toContain('branch');
      expect(selectedCols).toContain('college_year');

      // CRITICAL PRIVACY: Never select private fields
      expect(selectedCols).not.toContain('real_name');
      expect(selectedCols).not.toContain('email');
      expect(selectedCols).not.toContain('instagram_handle');

      // Verify returned payload
      expect(data.users).toHaveLength(1);
      const user = data.users[0];
      expect(user.display_name).toBe('Dandiya_King');
      expect(user.vibe_tag).toBe('Pro Garba Dancer 💃');
      expect(user.outfit_color).toBe('Black mirror-work Kurta');

      // Ensure no private properties exist on public users
      expect(user).not.toHaveProperty('real_name');
      expect(user).not.toHaveProperty('email');
      expect(user).not.toHaveProperty('instagram_handle');
    });
  });

  describe('Contact details after a mutual exchange (PRIV-001, ID-001)', () => {
    const revealRow = (data: unknown) => ({
      select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data, error: null }) }) }),
    });

    it('returns real_name and email only, and never selects instagram_handle', async () => {
      mocks.supabaseFrom.mockImplementation((table: string) => {
        if (table === 'contact_reveals') return revealRow({ user_a_id: 'user_alice', user_b_id: 'user_bob' });
        if (table === 'users') {
          return {
            select: (cols: string) => {
              expect(cols).not.toContain('instagram_handle');
              expect(cols).toContain('real_name');
              expect(cols).toContain('email');
              return {
                eq: () => ({
                  maybeSingle: () => Promise.resolve({ data: { real_name: 'Bob Sharma', email: 'bob@example.com', instagram_handle: 'bob_insta' }, error: null }),
                }),
              };
            },
          };
        }
        return {};
      });

      const identity = await getRevealedContact('user_alice', 'user_bob');
      // Even if the database returned more, only the two agreed fields leave this function.
      expect(identity).toEqual({ real_name: 'Bob Sharma', email: 'bob@example.com' });
      expect(identity).not.toHaveProperty('instagram_handle');
    });

    it('returns null without a contact_reveals row, and never reads the users table or the old reveals table', async () => {
      mocks.supabaseFrom.mockImplementation((table: string) => (table === 'contact_reveals' ? revealRow(null) : {}));

      expect(await getRevealedContact('user_alice', 'user_bob')).toBeNull();
      expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('users');
      expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('reveals');
    });

    it('returns null when the row found is not for exactly this pair', async () => {
      mocks.supabaseFrom.mockImplementation((table: string) =>
        table === 'contact_reveals' ? revealRow({ user_a_id: 'user_alice', user_b_id: 'user_carol' }) : {},
      );

      expect(await getRevealedContact('user_alice', 'user_bob')).toBeNull();
      expect(mocks.supabaseFrom).not.toHaveBeenCalledWith('users');
    });
  });

  describe('completeOnboarding Input Sanitization', () => {
    it('sanitizes instagram handle by removing leading @ and trimming whitespace', async () => {
      const saved: Record<string, unknown>[] = [];

      mocks.supabaseFrom.mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: () => {
              const chain = {
                eq: () => chain,
                neq: () => chain,
                maybeSingle: () => Promise.resolve({ data: null, error: null }),
              };
              return chain;
            },
            upsert: (payload: Record<string, unknown>) => {
              saved.push(payload);
              return Promise.resolve({ error: null });
            },
          };
        }
        return {};
      });

      mocks.currentUser.mockResolvedValue({
        firstName: 'Alice',
        lastName: 'Patel',
        primaryEmailAddress: { emailAddress: 'alice@example.com' },
      });

      const result = await completeOnboarding({
        gender: 'female',
        displayName: 'Garba_Queen',
        branch: 'ISE',
        collegeYear: '2nd Year',
        vibeTag: 'Here for Dandiya 🥢',
        outfitColor: 'Red & Yellow Bandhani Chaniya Choli',
        instagramHandle: '  @@alice_dancer_2026  ',
      });

      expect(result).toEqual({ ok: true });
      expect(saved).toHaveLength(1);
      const savedPayload = saved[0];
      expect(savedPayload.instagram_handle).toBe('alice_dancer_2026');
      expect(savedPayload.branch).toBe('ISE');
      expect(savedPayload.college_year).toBe('2nd Year');
      expect(savedPayload.vibe_tag).toBe('Here for Dandiya 🥢');
      expect(savedPayload.outfit_color).toBe('Red & Yellow Bandhani Chaniya Choli');
    });
  });
});
