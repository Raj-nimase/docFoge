import { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useAnimation, useReducedMotion } from 'motion/react';

const LENGTH = 6;

/**
 * Segmented 6-digit OTP input — auto-advance, backspace navigation,
 * paste distribution, digit-pop animation and an error shake triggered
 * by increments of `errorCount`.
 */
export default function OtpInput({ value, onChange, onComplete, errorCount = 0, disabled }) {
  const refs = useRef([]);
  const controls = useAnimation();
  const reducedMotion = useReducedMotion();
  const digits = Array.from({ length: LENGTH }, (_, i) => value[i] ?? '');

  // Shake + refocus on each failed verification (no remount, focus preserved).
  useEffect(() => {
    if (errorCount > 0) {
      if (!reducedMotion) {
        controls.start({ x: [0, -8, 8, -5, 5, -2, 0], transition: { duration: 0.4 } });
      }
      refs.current[0]?.focus();
    }
  }, [errorCount, controls, reducedMotion]);

  const commit = (next) => {
    const joined = next.join('').slice(0, LENGTH);
    onChange(joined);
    if (joined.length === LENGTH) onComplete?.(joined);
  };

  const handleChange = (i, raw) => {
    const chars = raw.replace(/\D/g, '');
    if (!chars) return;
    const next = [...digits];
    // Support typing/autofill spilling multiple chars into one box
    for (let k = 0; k < chars.length && i + k < LENGTH; k++) {
      next[i + k] = chars[k];
    }
    const focusIdx = Math.min(i + chars.length, LENGTH - 1);
    refs.current[focusIdx]?.focus();
    commit(next);
  };

  const handleKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const next = [...digits];
      if (next[i]) {
        next[i] = '';
      } else if (i > 0) {
        next[i - 1] = '';
        refs.current[i - 1]?.focus();
      }
      onChange(next.join(''));
    } else if (e.key === 'ArrowLeft' && i > 0) {
      e.preventDefault();
      refs.current[i - 1]?.focus();
    } else if (e.key === 'ArrowRight' && i < LENGTH - 1) {
      e.preventDefault();
      refs.current[i + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const chars = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, LENGTH);
    if (!chars) return;
    const next = chars.split('');
    while (next.length < LENGTH) next.push('');
    refs.current[Math.min(chars.length, LENGTH - 1)]?.focus();
    commit(next);
  };

  return (
    <motion.div className="auth-otp-group" animate={controls}>
      {digits.map((digit, i) => (
        <div
          key={i}
          className={[
            'auth-otp-box',
            digit && 'auth-otp-box--filled',
            errorCount > 0 && 'auth-otp-box--error',
          ].filter(Boolean).join(' ')}
        >
          <AnimatePresence mode="popLayout" initial={false}>
            {digit && (
              <motion.span
                key={`${i}-${digit}`}
                className="auth-otp-digit"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 600, damping: 30 }}
              >
                {digit}
              </motion.span>
            )}
          </AnimatePresence>
          <input
            ref={el => { refs.current[i] = el; }}
            value=""
            onChange={e => handleChange(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            onPaste={handlePaste}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
            disabled={disabled}
          />
        </div>
      ))}
    </motion.div>
  );
}
