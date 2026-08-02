import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { EASE } from './authMotion';

/** Error / success banner that collapses smoothly in and out. */
export default function FormMessage({ type = 'error', message }) {
  return (
    <AnimatePresence initial={false}>
      {message && (
        <motion.div
          key={`${type}-${message}`}
          initial={{ opacity: 0, height: 0, y: -4 }}
          animate={{ opacity: 1, height: 'auto', y: 0 }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
          style={{ overflow: 'hidden' }}
        >
          <p
            className={`auth-message auth-message--${type}`}
            role={type === 'error' ? 'alert' : 'status'}
          >
            {type === 'error' ? <AlertCircle size={14} /> : <CheckCircle2 size={14} />}
            {message}
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
