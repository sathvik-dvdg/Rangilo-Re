import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Narrows parsed JSON so fields can be read without a cast. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function initials(name: string) {
  const parts = name.replace(/_\d+$/, '').split(/[_\s]+/).filter(Boolean);
  const first = parts[0]?.[0] ?? '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

export function timeAgo(iso: string) {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Orders a refetched dancer list like the one already on screen: dancers who were shown
 * keep their places, newcomers go first in server order. Data comes from `next`. The
 * server sorts by last_seen, which every heartbeat changes, so without this each refetch
 * reshuffled the list under the user.
 */
export function keepOrder<T extends { clerk_id: string }>(prev: T[] | null, next: T[]): T[] {
  if (!prev) return next;
  const place = new Map(prev.map((u, i) => [u.clerk_id, i]));
  const newcomers = next.filter((u) => !place.has(u.clerk_id));
  const known = next.filter((u) => place.has(u.clerk_id)).sort((a, b) => place.get(a.clerk_id)! - place.get(b.clerk_id)!);
  return [...newcomers, ...known];
}

/** Deterministic pair of palette colours for an avatar, keyed by name. */
const AVATAR_PAIRS: [string, string][] = [
  ['#B23A2E', '#D8A23A'],
  ['#2F4B6E', '#C2566B'],
  ['#6B7A3A', '#D8A23A'],
  ['#8A2A21', '#C2566B'],
  ['#2F4B6E', '#6B7A3A'],
  ['#A87B22', '#B23A2E'],
];

export function avatarColors(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PAIRS[h % AVATAR_PAIRS.length];
}
