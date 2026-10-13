export type Gender = 'male' | 'female' | 'other';

export const VIBE_TAGS = [
  'Pro Garba Dancer 💃',
  'Here for Dandiya 🥢',
  'Beginner (Teach Me!) 😅',
  'Here for Food & Photos 📸',
  'Looking for a Group 👥',
] as const;

export type VibeTag = (typeof VIBE_TAGS)[number];

export type PublicProfile = {
  clerk_id: string;
  display_name: string;
  gender: Gender;
  branch?: string;
  college_year?: string;
  vibe_tag?: string;
  outfit_color?: string;
  last_seen: string;
};

export type MyProfile = PublicProfile & {
  real_name: string;
  email: string;
  instagram_handle?: string;
};

export type Message = {
  id: string;
  room_id: string;
  sender_id: string;
  text: string;
  created_at: string;
  read_by: string[];
  /** Client-only: optimistic message not yet confirmed by the server. */
  pending?: boolean;
};

/** The only fields a contact exchange ever shares. Never widen this without a new consent decision (ID-001). */
export type RevealedIdentity = {
  real_name: string;
  email: string;
};

export type ConsentStatus = 'pending' | 'accepted' | 'declined' | 'expired';

/** Where a room's connect request stands, from one participant's side. */
export type RoomConsent = {
  /** The latest request in this room; null when nobody has asked. */
  status: ConsentStatus | null;
  /** Whether this user sent that request or is the one being asked. */
  role: 'requester' | 'partner' | null;
  /** False while a request is open, once connected, or once this user has asked in this room. */
  canRequest: boolean;
};

export type RoomState = {
  roomId: string;
  me: PublicProfile;
  partner: PublicProfile;
  messages: Message[];
  timerStartedAt: string | null;
  extraSeconds: number;
  /** True once the room has been paid for: the chat no longer expires, whatever the partner answers. */
  unlimited: boolean;
  consent: RoomConsent;
  /** The partner's contact details. Set only when a contact_reveals row exists for the pair. */
  revealed: RevealedIdentity | null;
};

/**
 * Paid products. 'connect' makes the chat unlimited and asks the partner to
 * exchange contact details. The payment never discloses anything itself;
 * only the partner's consent does (DEC-002 as revised 2026-10-14, ID-002).
 */
export type PaymentType = 'connect';
