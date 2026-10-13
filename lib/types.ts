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

/** What one dancer may see of another once that dancer agreed and the payment was verified. Never an email. */
export type RevealedIdentity = {
  real_name: string;
  /** The photo they uploaded to their account, or null if they have none. */
  image_url: string | null;
};

/** Where a request to see someone's name and photo stands. 'none': never asked. */
export type RevealStatus = 'none' | 'pending' | 'allowed' | 'declined' | 'revealed';

export type RevealState = {
  /** My request to see my partner. */
  outgoing: RevealStatus;
  /** My partner's request to see me. */
  incoming: RevealStatus;
  /** What I would be sharing, shown to me while I decide. Only set while `incoming` is 'pending'. */
  sharing: RevealedIdentity | null;
};

export type RoomState = {
  roomId: string;
  me: PublicProfile;
  partner: PublicProfile;
  messages: Message[];
  timerStartedAt: string | null;
  extraSeconds: number;
  /** My partner's name and photo, once they agreed and I paid (`reveal.outgoing` is 'revealed'). */
  revealed: RevealedIdentity | null;
  reveal: RevealState;
};

/**
 * Paid products. 'reveal' shows the other dancer's real name and photo, and can
 * only be bought after that dancer has agreed (DEC-012, ID-001, PAY-017).
 */
export type PaymentType = 'extend' | 'reveal';
