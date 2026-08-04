import { MotionConfig } from 'motion/react';
import useAuthStore from '@/contexts/authStore/authStore';
import useLenis from '@/hooks/useLenis';
import TopBar from '../components/TopBar/TopBar';
import Hero from '../components/Hero/Hero';
import FeaturesSection from '../components/FeaturesSection/FeaturesSection';
import HowItWorks from '../components/HowItWorks/HowItWorks';
import CtaBand from '../components/CtaBand/CtaBand';
import Footer from '../components/Footer/Footer';
import '../landing.css';

/**
 * Public marketing landing page at "/".
 * Authenticated users see "Open dashboard" CTAs instead of Sign in.
 * Lenis provides smooth scrolling for the lifetime of this page only.
 */
export default function LandingPage() {
  const isAuthed = useAuthStore((s) => s.status === 'authenticated');
  const lenisRef = useLenis();

  // Smooth-scroll helper that routes through Lenis when available,
  // falling back to native behavior (e.g. reduced motion).
  const scrollTo = (target) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: target === 0 ? 0 : -24 });
    } else if (target === 0) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      document.querySelector(target)?.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="landing-page">
        <TopBar isAuthed={isAuthed} onScrollTop={() => scrollTo(0)} />
        <main>
          <Hero isAuthed={isAuthed} onSeeHow={() => scrollTo('#how')} />
          <FeaturesSection />
          <HowItWorks />
          <CtaBand isAuthed={isAuthed} />
        </main>
        <Footer />
      </div>
    </MotionConfig>
  );
}
