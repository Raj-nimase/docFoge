import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Eye, EyeOff, Check } from 'lucide-react';
import { fieldVariants } from './authMotion';

/**
 * Labeled input with leading icon, optional password reveal toggle and
 * optional live hint line. Renders as a motion.div so field-cascade
 * variants propagate from the parent pane automatically.
 */
export default function TextField({
  label,
  icon: Icon,
  type = 'text',
  revealable = false,
  hint,
  hintOk = false,
  labelAction,
  inputRef,
  ...inputProps
}) {
  const [show, setShow] = useState(false);
  const resolvedType = revealable ? (show ? 'text' : 'password') : type;

  return (
    <motion.div className="auth-field" variants={fieldVariants}>
      <label className="auth-field-label-row">
        <span className="auth-field-label">{label}</span>
        {labelAction}
      </label>
      <div className="auth-input-wrap">
        {Icon && <Icon size={16} />}
        <input ref={inputRef} type={resolvedType} {...inputProps} />
        {revealable && (
          <button
            type="button"
            className="auth-reveal-btn"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Hide password' : 'Show password'}
            tabIndex={-1}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={show ? 'off' : 'on'}
                style={{ display: 'inline-flex' }}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </motion.span>
            </AnimatePresence>
          </button>
        )}
      </div>
      {hint && (
        <span className={`auth-field-hint${hintOk ? ' auth-field-hint--ok' : ''}`}>
          {hintOk && <Check size={12} />}
          {hint}
        </span>
      )}
    </motion.div>
  );
}
