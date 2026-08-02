import { motion } from 'motion/react';

const TABS = [
  { id: 'login', label: 'Sign in' },
  { id: 'register', label: 'Create account' },
];

/** Segmented Sign in / Create account control with a sliding pill indicator. */
export default function AuthTabs({ mode, onChange }) {
  return (
    <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
      {TABS.map(tab => (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={mode === tab.id}
          className={`auth-tab${mode === tab.id ? ' auth-tab--active' : ''}`}
          onClick={() => onChange(tab.id)}
        >
          {mode === tab.id && (
            <motion.span
              layoutId="auth-tab-pill"
              className="auth-tab-pill"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <span className="auth-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
