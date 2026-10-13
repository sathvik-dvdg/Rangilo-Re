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

export type RevealedIdentity = {
  real_name: string;
  email: string;
  instagram_handle?: string;
};

export type RoomState = {
  roomId: string;
  me: PublicProfile;
  partner: PublicProfile;
  messages: Message[];
  timerStartedAt: string | null;
  extraSeconds: number;
  revealed: RevealedIdentity | null;
};

export type PaymentType = 'reveal' | 'extend';
