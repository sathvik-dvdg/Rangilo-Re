import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { FeaturesReveal } from '@/components/landing/FeaturesReveal';
import { StatsCounter } from '@/components/landing/StatsCounter';
import { Testimonials } from '@/components/landing/Testimonials';
import { ClosingCta } from '@/components/landing/ClosingCta';

export default function LandingPage() {
  return (
    <main>
      <HeroSection />
      <HowItWorks />
      <FeaturesReveal />
      <StatsCounter />
      <Testimonials />
      <ClosingCta />
    </main>
  );
}
