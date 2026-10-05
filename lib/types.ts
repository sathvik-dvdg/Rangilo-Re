export type Gender = 'male' | 'female' | 'other';

export type PublicProfile = {
  clerk_id: string;
  display_name: string;
  gender: Gender;
  last_seen: string;
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
