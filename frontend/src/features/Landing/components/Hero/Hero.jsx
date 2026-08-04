import { useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform, useReducedMotion } from 'motion/react';
import {
  SketchUnderline,
  SketchCircle,
  SketchHeroAccent,
} from '@/components/SketchDecor/SketchDecor';
import HeroDemo from '../HeroDemo/HeroDemo';
import {
  heroVariants,
  heroItemVariants,
  heroDemoVariants,
  floatSlow,
} from '../../landingMotion';

/**
 * Hero: large centered auto-playing demo with headline fragments
 * floating at the sides (stacked above on smaller screens).
 * Fragments drift apart gently on scroll (parallax paired with Lenis).
 */
export default function Hero({ isAuthed, onSeeHow }) {
  const navigate = useNavigate();
  const reducedMotion = useReducedMotion();
  const sectionRef = useRef(null);

  const scrollToHow = () => {
    if (onSeeHow) onSeeHow();
    else document.getElementById('how')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Scroll-linked parallax: fragments drift at different speeds as the
  // hero leaves the viewport; the demo sinks slightly slower than the page.
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const leftY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -70]);
  const rightY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : -30]);
  const demoY = useTransform(scrollYProgress, [0, 1], [0, reducedMotion ? 0 : 50]);
  const fadeOut = useTransform(scrollYProgress, [0, 0.85], [1, reducedMotion ? 1 : 0.25]);

  return (
    <motion.section
      ref={sectionRef}
      className="landing-hero"
      variants={heroVariants}
      initial="hidden"
      animate="show"
    >
      {/* left fragment */}
      <motion.div
        className="hero-fragment hero-fragment--left"
        variants={heroItemVariants}
        style={{ y: leftY, opacity: fadeOut }}
      >
        <SketchCircle className="hero-fragment-circle" size={150} />
        <h1 className="hero-headline">Messy drafts,</h1>
        <p className="hero-support">
          <motion.span className="hero-support-float" {...floatSlow}>
            Paste from Word, Markdown or LaTeX — anything you have.
          </motion.span>
        </p>
      </motion.div>

      {/* center demo */}
      <motion.div className="hero-center" variants={heroDemoVariants} style={{ y: demoY }}>
        <SketchHeroAccent className="hero-center-accent" />
        <HeroDemo />
        <motion.div className="hero-ctas" variants={heroItemVariants}>
          {isAuthed ? (
            <button
              type="button"
              className="btn-primary hero-cta-primary"
              onClick={() => navigate('/dashboard')}
            >
              Open dashboard
            </button>
          ) : (
            <button
              type="button"
              className="btn-primary hero-cta-primary"
              onClick={() => navigate('/auth')}
            >
              Get started
            </button>
          )}
          <button type="button" className="btn-ghost hero-cta-ghost" onClick={scrollToHow}>
            See how it works
          </button>
        </motion.div>
      </motion.div>

      {/* right fragment */}
      <motion.div
        className="hero-fragment hero-fragment--right"
        variants={heroItemVariants}
        style={{ y: rightY, opacity: fadeOut }}
      >
        <h1 className="hero-headline">
          beautiful <span className="hero-headline-mark">theses.</span>
        </h1>
        <SketchUnderline className="hero-fragment-underline" />
        <p className="hero-support">
          <motion.span className="hero-support-float" {...floatSlow}>
            University-standard formatting, applied automatically as you write.
          </motion.span>
        </p>
      </motion.div>
    </motion.section>
  );
}
