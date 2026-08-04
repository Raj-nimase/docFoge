import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { revealVariants, revealViewport } from '../../landingMotion';

/** Full-width sage call-to-action band before the footer. */
export default function CtaBand({ isAuthed }) {
  const navigate = useNavigate();

  return (
    <motion.section
      className="landing-cta-band"
      variants={revealVariants}
      initial="hidden"
      whileInView="show"
      viewport={revealViewport}
    >
      <h2 className="landing-cta-heading">Write once. Format never.</h2>
      <p className="landing-cta-sub">
        Join researchers who let Acadoc handle the formatting while they handle the ideas.
      </p>
      <motion.button
        type="button"
        className="landing-cta-btn"
        onClick={() => navigate(isAuthed ? '/dashboard' : '/auth')}
        whileTap={{ scale: 0.96 }}
      >
        {isAuthed ? 'Open dashboard' : 'Get started — sign in'}
      </motion.button>
    </motion.section>
  );
}
