import { motion, AnimatePresence } from 'motion/react';
import { Loader2 } from 'lucide-react';
import { EASE } from './authMotion';

/** Primary submit button with an animated label ↔ spinner swap. */
export default function SubmitButton({ loading, label, loadingLabel = 'Please wait…' }) {
  return (
    <button type="submit" className="btn-primary auth-submit" disabled={loading}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={loading ? '__loading' : label}
          className="auth-submit-inner"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18, ease: EASE }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="auth-spinner" />
              {loadingLabel}
            </>
          ) : (
            label
          )}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
