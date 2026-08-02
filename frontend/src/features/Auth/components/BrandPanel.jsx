import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'motion/react';
import { GraduationCap, Hourglass } from 'lucide-react';
import {
  SketchHeroAccent,
  SketchUnderline,
  SketchCircle,
  SketchDocument,
} from '@/components/SketchDecor/SketchDecor';
import { EASE, childVariants } from './authMotion';

const QUOTES = [
  'Structured writing for serious research.',
  'Your thesis, from outline to bound PDF.',
  'Write once. Format never.',
];

const QUOTE_INTERVAL = 6000;

/** Left branding panel — wordmark, sketch art, rotating quotes, trial notice. */
export default function BrandPanel({ trialExpired = false }) {
  const [quoteIdx, setQuoteIdx] = useState(0);
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return undefined;
    const id = setInterval(() => setQuoteIdx(i => (i + 1) % QUOTES.length), QUOTE_INTERVAL);
    return () => clearInterval(id);
  }, [reducedMotion]);

  return (
    <div className="auth-brand-panel">
      <SketchHeroAccent />

      <motion.div className="auth-brand-wordmark" variants={childVariants}>
        <GraduationCap size={28} strokeWidth={2} />
        <h1>AcaDoc Pro</h1>
      </motion.div>
      <SketchUnderline className="auth-brand-underline" />

      <motion.p className="auth-brand-tagline" variants={childVariants}>
        Sign in to save projects to the cloud and sync across devices.
      </motion.p>

      {trialExpired && (
        <motion.div className="auth-brand-trial" variants={childVariants}>
          <Hourglass size={14} />
          <span>Your free trial has ended — sign in or create an account to keep working.</span>
        </motion.div>
      )}

      <motion.div className="auth-brand-art" variants={childVariants} aria-hidden>
        <SketchCircle size={150} />
        <SketchDocument size={64} />
      </motion.div>

      <div className="auth-brand-quote-viewport">
        <AnimatePresence mode="wait" initial={false}>
          <motion.blockquote
            key={quoteIdx}
            className="auth-brand-quote"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5, ease: EASE }}
          >
            "{QUOTES[quoteIdx]}"
          </motion.blockquote>
        </AnimatePresence>
      </div>
    </div>
  );
}
