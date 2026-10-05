import { SignIn } from '@clerk/nextjs';

// Explicit paths so routing and the post-auth redirect don't depend on optional env vars.
export default function Page() {
  return <SignIn path="/sign-in" routing="path" signUpUrl="/sign-up" fallbackRedirectUrl="/dashboard" />;
}
