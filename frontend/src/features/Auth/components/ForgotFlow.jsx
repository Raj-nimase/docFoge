import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock } from 'lucide-react';
import TextField from './TextField';
import SubmitButton from './SubmitButton';
import OtpInput from './OtpInput';
import { fieldVariants } from './authMotion';

const STEP_COPY = {
  1: {
    title: 'Reset your password',
    sub: "Enter your account email and we'll send you a 6-digit verification code.",
    cta: 'Send verification code',
    loading: 'Sending code…',
  },
  2: {
    title: 'Check your inbox',
    sub: 'Enter the 6-digit code we just sent to your email.',
    cta: 'Verify code',
    loading: 'Verifying…',
  },
  3: {
    title: 'Set a new password',
    sub: "You're verified — choose a new password for your account.",
    cta: 'Set new password',
    loading: 'Updating…',
  },
};

const RESEND_COOLDOWN = 30;

/**
 * Renders the current forgot-password step. The parent AnimatePresence
 * remounts this per step, so per-step local state (resend cooldown)
 * initializes naturally on entry.
 */
export default function ForgotFlow({
  step,
  email,
  onEmailChange,
  otpCode,
  onOtpChange,
  onOtpComplete,
  otpErrorCount,
  newPassword,
  onNewPasswordChange,
  confirmPassword,
  onConfirmPasswordChange,
  loading,
  onSubmit,
  onResend,
  firstFieldRef,
}) {
  const copy = STEP_COPY[step];
  const [cooldown, setCooldown] = useState(step === 2 ? RESEND_COOLDOWN : 0);

  useEffect(() => {
    if (step !== 2 || cooldown <= 0) return undefined;
    const id = setInterval(() => setCooldown(c => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [step, cooldown]);

  const handleResend = async () => {
    if (cooldown > 0 || loading) return;
    setCooldown(RESEND_COOLDOWN);
    await onResend();
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <motion.div className="auth-pane-heading" variants={fieldVariants}>
        <h2>{copy.title}</h2>
        <p>{copy.sub}</p>
      </motion.div>

      {step === 1 && (
        <TextField
          label="Account email"
          icon={Mail}
          type="email"
          value={email}
          onChange={e => onEmailChange(e.target.value)}
          placeholder="you@university.edu"
          required
          autoComplete="email"
          inputRef={firstFieldRef}
        />
      )}

      {step === 2 && (
        <>
          <motion.div variants={fieldVariants}>
            <OtpInput
              value={otpCode}
              onChange={onOtpChange}
              onComplete={onOtpComplete}
              errorCount={otpErrorCount}
              disabled={loading}
            />
          </motion.div>
          <motion.div className="auth-resend-row" variants={fieldVariants}>
            <span>Didn't get a code?</span>
            <button
              type="button"
              className="auth-resend-btn"
              onClick={handleResend}
              disabled={cooldown > 0 || loading}
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend'}
            </button>
          </motion.div>
        </>
      )}

      {step === 3 && (
        <>
          <TextField
            label="New password"
            icon={Lock}
            revealable
            value={newPassword}
            onChange={e => onNewPasswordChange(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
            hint="At least 8 characters"
            hintOk={newPassword.length >= 8}
            inputRef={firstFieldRef}
          />
          <TextField
            label="Confirm new password"
            icon={Lock}
            revealable
            value={confirmPassword}
            onChange={e => onConfirmPasswordChange(e.target.value)}
            placeholder="Re-enter new password"
            required
            minLength={8}
            autoComplete="new-password"
          />
        </>
      )}

      <motion.div variants={fieldVariants}>
        <SubmitButton loading={loading} label={copy.cta} loadingLabel={copy.loading} />
      </motion.div>
    </form>
  );
}
