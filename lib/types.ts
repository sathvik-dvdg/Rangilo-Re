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

/**
 * What one dancer may see of another once that dancer agreed and the payment was verified.
 * For the reveal flow: real name + photo (never email).
 * For the connect flow: real name + email (via contact_reveals row).
 */
export type RevealedIdentity = {
  real_name: string;
  /** The photo they uploaded to their account, or null if they have none. Only set by the reveal flow. */
  image_url?: string | null;
  /** Their email, set only by the connect/consent flow. Never set by the reveal flow (ID-001). */
  email?: string;
};

/** Where a request to see someone's name and photo stands. 'none': never asked. */
export type RevealStatus = 'none' | 'pending' | 'allowed' | 'declined' | 'revealed';

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
  /** The contact-consent state for the connect flow (contact_consents table). */
  consent: RoomConsent;
  /** The partner's contact details (name + email), set once a contact_reveals row exists for the pair (connect flow). */
  revealed: RevealedIdentity | null;
  /** The partner's real name and photo, if they agreed to share them before the free ask was retired (DEC-013). */
  sharedWithMe: RevealedIdentity | null;
};

/**
 * Paid products.
 * 'connect' — makes the chat unlimited and asks the partner to exchange contact details.
 *             The payment never discloses anything itself; only the partner's consent does (ID-002).
 * 'extend'  — retired: adds two minutes. Only on orders created before it was withdrawn (DEC-004).
 * 'reveal'  — retired: real name and photo after the other dancer agreed. Only on orders created
 *             before only paying users could request (DEC-013, ID-001, PAY-017).
 * create-order sells 'connect' only.
 */
export type PaymentType = 'connect' | 'extend' | 'reveal';
