import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, KeyRound, ShieldCheck } from 'lucide-react';
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

export default function ForgotFlow({
  method, // null | 'otp' | 'current_password'
  onSelectMethod,
  step,
  email,
  onEmailChange,
  currentPassword,
  onCurrentPasswordChange,
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

  // Step 0: Method Selection
  if (!method) {
    return (
      <div className="auth-form">
        <motion.div className="auth-pane-heading" variants={fieldVariants}>
          <h2>Reset password</h2>
          <p>Choose your preferred recovery option to update your password.</p>
        </motion.div>

        <motion.div className="auth-method-grid" variants={fieldVariants}>
          <motion.div
            className="auth-method-card"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectMethod('otp')}
          >
            <div className="auth-method-icon-wrap">
              <Mail size={22} />
            </div>
            <div className="auth-method-content">
              <div className="auth-method-title">Verify via Email (OTP)</div>
              <div className="auth-method-desc">
                Receive a 6-digit verification code to your registered email address.
              </div>
            </div>
          </motion.div>

          <motion.div
            className="auth-method-card"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onSelectMethod('current_password')}
          >
            <div className="auth-method-icon-wrap">
              <KeyRound size={22} />
            </div>
            <div className="auth-method-content">
              <div className="auth-method-title">Use Current Password</div>
              <div className="auth-method-desc">
                Update your password instantly if you remember your current password.
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    );
  }

  // Method 2: Reset using Current Password
  if (method === 'current_password') {
    return (
      <form className="auth-form" onSubmit={onSubmit}>
        <motion.div className="auth-pane-heading" variants={fieldVariants}>
          <h2>Reset with current password</h2>
          <p>Enter your email, current password, and choose a new password.</p>
        </motion.div>

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

        <TextField
          label="Current password"
          icon={KeyRound}
          type="password"
          revealable
          value={currentPassword}
          onChange={e => onCurrentPasswordChange(e.target.value)}
          placeholder="Enter current password"
          required
          autoComplete="current-password"
        />

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

        <motion.div variants={fieldVariants}>
          <SubmitButton loading={loading} label="Update password" loadingLabel="Updating password…" />
        </motion.div>
      </form>
    );
  }

  // Method 1: Email OTP Flow (Steps 1, 2, 3)
  const copy = STEP_COPY[step] || STEP_COPY[1];

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
