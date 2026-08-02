import { Check } from 'lucide-react';

/** Progress dots for the 3-step forgot-password flow. */
export default function StepDots({ step, total = 3 }) {
  return (
    <div className="auth-step-dots" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const cls = n === step
          ? 'auth-step-dot auth-step-dot--active'
          : n < step
            ? 'auth-step-dot auth-step-dot--done'
            : 'auth-step-dot';
        return (
          <span key={n} className={cls}>
            {n < step && <Check size={9} strokeWidth={3} />}
          </span>
        );
      })}
    </div>
  );
}
