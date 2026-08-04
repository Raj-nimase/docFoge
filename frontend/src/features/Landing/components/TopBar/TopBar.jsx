import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { GraduationCap } from 'lucide-react';
import { EASE } from '../../landingMotion';

/**
 * Minimal landing top bar — wordmark left, auth CTAs right. No nav links.
 * Gains a blurred backdrop once the page scrolls.
 */
export default function TopBar({ isAuthed, onScrollTop }) {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <motion.header
      className={`landing-topbar ${scrolled ? 'landing-topbar--scrolled' : ''}`}
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: EASE }}
    >
      <a
        className="landing-wordmark"
        href="/"
        onClick={(e) => {
          e.preventDefault();
          if (onScrollTop) onScrollTop();
          else window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        <GraduationCap size={24} strokeWidth={2.2} aria-hidden />
        <span>Acadoc</span>
      </a>

      <div className="landing-topbar-actions">
        {isAuthed ? (
          <motion.button
            type="button"
            className="btn-primary landing-topbar-cta"
            onClick={() => navigate('/dashboard')}
            whileTap={{ scale: 0.96 }}
          >
            Open dashboard
          </motion.button>
        ) : (
          <>
            <motion.button
              type="button"
              className="btn-ghost landing-topbar-signin"
              onClick={() => navigate('/auth')}
              whileTap={{ scale: 0.96 }}
            >
              Sign in
            </motion.button>
            <motion.button
              type="button"
              className="btn-primary landing-topbar-cta"
              onClick={() => navigate('/auth')}
              whileTap={{ scale: 0.96 }}
            >
              Get started
            </motion.button>
          </>
        )}
      </div>
    </motion.header>
  );
}
