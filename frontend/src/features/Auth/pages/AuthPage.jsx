import { useRef, useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import { X, ArrowLeft } from 'lucide-react';
import useAuthStore from '@/contexts/authStore/authStore';
import AuthTabs from '../components/AuthTabs';
import BrandPanel from '../components/BrandPanel';
import LoginForm from '../components/LoginForm';
import RegisterForm from '../components/RegisterForm';
import ForgotFlow from '../components/ForgotFlow';
import FormMessage from '../components/FormMessage';
import StepDots from '../components/StepDots';
import { EASE, shellVariants, childVariants, paneVariants } from '../components/authMotion';
import '../auth.css';

/** Mode ordering for direction-aware slides; forgot always enters from the left. */
const ORDER = { login: 0, register: 1, forgot: -1 };

/** Auto-height wrapper so pane switches animate the container smoothly. */
function AnimatedHeightPane({ children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState('auto');

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([entry]) => setHeight(entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <motion.div
      className="auth-pane-clip"
      animate={{ height }}
      transition={{ duration: 0.4, ease: EASE }}
    >
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

export default function Auth({ trialExpired = false, allowDismiss = false, onDismiss, onSuccess }) {
  const register = useAuthStore(s => s.register);
  const login = useAuthStore(s => s.login);
  const forgotPassword = useAuthStore(s => s.forgotPassword);
  const verifyOtp = useAuthStore(s => s.verifyOtp);
  const resetPassword = useAuthStore(s => s.resetPassword);

  const [mode, setMode] = useState('login'); // login | register | forgot
  const [forgotStep, setForgotStep] = useState(1); // 1: email, 2: OTP, 3: new password
  const [direction, setDirection] = useState(1);
  const [resetToken, setResetToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpErrorCount, setOtpErrorCount] = useState(0);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Student',
    institution: '',
    department: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const firstFieldRef = useRef(null);
  const loadingRef = useRef(false);

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  const switchMode = (next) => {
    if (next === mode) return;
    setDirection(Math.sign(ORDER[next] - ORDER[mode]) || 1);
    setMode(next);
    if (next === 'forgot') setForgotStep(1);
    clearMessages();
  };

  const goToStep = (next) => {
    setDirection(next > forgotStep ? 1 : -1);
    setForgotStep(next);
  };

  const backToLogin = () => {
    setDirection(1);
    setMode('login');
    setForgotStep(1);
    setOtpCode('');
    setOtpErrorCount(0);
    setResetToken('');
    setNewPassword('');
    setConfirmPassword('');
    clearMessages();
  };

  const runSubmit = useCallback(async (action) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    try {
      await action();
    } catch (err) {
      setError(err.message || 'Something went wrong');
      throw err;
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    clearMessages();
    await runSubmit(async () => {
      await login(form.email, form.password);
      await onSuccess?.();
    }).catch(() => {});
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    clearMessages();
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    await runSubmit(async () => {
      await register({ ...form, email: form.email.trim() });
      await onSuccess?.();
    }).catch(() => {});
  };

  const submitForgotEmail = async () => {
    await runSubmit(async () => {
      const res = await forgotPassword(form.email);
      setOtpCode('');
      setOtpErrorCount(0);
      goToStep(2);
      setSuccessMessage(res.message || 'Verification code sent to your email.');
    }).catch(() => {});
  };

  const submitOtp = async (code) => {
    if (loadingRef.current) return;
    clearMessages();
    await runSubmit(async () => {
      const res = await verifyOtp(form.email, code);
      setResetToken(res.resetToken);
      setOtpErrorCount(0);
      goToStep(3);
      setSuccessMessage('Code verified! Enter your new password below.');
    }).catch(() => {
      setOtpCode('');
      setOtpErrorCount(c => c + 1);
    });
  };

  const submitNewPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    await runSubmit(async () => {
      await resetPassword(form.email, resetToken, newPassword);
      await onSuccess?.();
    }).catch(() => {});
  };

  const handleForgotSubmit = async (e) => {
    e.preventDefault();
    clearMessages();
    if (forgotStep === 1) await submitForgotEmail();
    else if (forgotStep === 2) await submitOtp(otpCode);
    else await submitNewPassword();
  };

  const handleResend = async () => {
    clearMessages();
    await runSubmit(async () => {
      const res = await forgotPassword(form.email);
      setSuccessMessage(res.message || 'A new code is on its way.');
    }).catch(() => {});
  };

  const paneKey = mode === 'forgot' ? `forgot-${forgotStep}` : mode;

  const focusFirstField = () => {
    // Skip autofocus on touch/mobile widths to avoid keyboard pop
    if (window.innerWidth > 860) firstFieldRef.current?.focus();
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="auth-page">
        <motion.div
          className="auth-shell"
          variants={shellVariants}
          initial="hidden"
          animate="show"
        >
          {allowDismiss && onDismiss && (
            <button type="button" className="auth-dismiss" onClick={onDismiss} aria-label="Close">
              <X size={18} />
            </button>
          )}

          <BrandPanel trialExpired={trialExpired} />

          <div className="auth-form-panel">
            <motion.div variants={childVariants}>
              {mode !== 'forgot' ? (
                <AuthTabs mode={mode} onChange={switchMode} />
              ) : (
                <div className="auth-forgot-header">
                  <button type="button" className="auth-back-btn" onClick={backToLogin}>
                    <ArrowLeft size={16} /> Back to sign in
                  </button>
                  <StepDots step={forgotStep} />
                </div>
              )}
            </motion.div>

            <FormMessage type="success" message={successMessage} />
            <FormMessage type="error" message={error} />

            <AnimatedHeightPane>
              <AnimatePresence mode="popLayout" custom={direction} initial={false}>
                <motion.div
                  key={paneKey}
                  className="auth-pane"
                  custom={direction}
                  variants={paneVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  onAnimationComplete={(definition) => {
                    if (definition === 'center') focusFirstField();
                  }}
                >
                  {mode === 'login' && (
                    <LoginForm
                      form={form}
                      set={set}
                      loading={loading}
                      onSubmit={handleLogin}
                      onForgot={() => switchMode('forgot')}
                      firstFieldRef={firstFieldRef}
                    />
                  )}
                  {mode === 'register' && (
                    <RegisterForm
                      form={form}
                      set={set}
                      loading={loading}
                      onSubmit={handleRegister}
                      firstFieldRef={firstFieldRef}
                    />
                  )}
                  {mode === 'forgot' && (
                    <ForgotFlow
                      step={forgotStep}
                      email={form.email}
                      onEmailChange={v => set('email', v)}
                      otpCode={otpCode}
                      onOtpChange={(v) => { setOtpCode(v); if (otpErrorCount) setOtpErrorCount(0); }}
                      onOtpComplete={submitOtp}
                      otpErrorCount={otpErrorCount}
                      newPassword={newPassword}
                      onNewPasswordChange={setNewPassword}
                      confirmPassword={confirmPassword}
                      onConfirmPasswordChange={setConfirmPassword}
                      loading={loading}
                      onSubmit={handleForgotSubmit}
                      onResend={handleResend}
                      firstFieldRef={firstFieldRef}
                    />
                  )}
                </motion.div>
              </AnimatePresence>
            </AnimatedHeightPane>
          </div>
        </motion.div>
      </div>
    </MotionConfig>
  );
}
