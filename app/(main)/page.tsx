import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeaturesReveal } from '@/components/landing/FeaturesReveal';
import { ClosingCta } from '@/components/landing/ClosingCta';

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <FeaturesReveal />
      <ClosingCta />
    </main>
  );
}
