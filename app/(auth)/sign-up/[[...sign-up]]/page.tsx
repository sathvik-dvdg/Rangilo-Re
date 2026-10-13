import { SignUp } from '@clerk/nextjs';

// Explicit paths so routing and the post-auth redirect don't depend on optional env vars.
export default function Page() {
  return <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" fallbackRedirectUrl="/dashboard" />;
}
