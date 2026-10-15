type HeaderEnv = { NODE_ENV?: string; NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?: string; NEXT_PUBLIC_SUPABASE_URL?: string };

export function clerkFrontendApiHost(key: string | undefined): string | null;
export function contentSecurityPolicy(env: HeaderEnv): string;
export function securityHeaders(env: HeaderEnv): { key: string; value: string }[];
