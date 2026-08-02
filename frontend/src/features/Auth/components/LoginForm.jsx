import { motion } from 'motion/react';
import { Mail, Lock } from 'lucide-react';
import TextField from './TextField';
import SubmitButton from './SubmitButton';
import { fieldVariants } from './authMotion';

export default function LoginForm({ form, set, loading, onSubmit, onForgot, firstFieldRef }) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <motion.div className="auth-pane-heading" variants={fieldVariants}>
        <h2>Welcome back</h2>
        <p>Sign in to sync your projects across devices.</p>
      </motion.div>

      <TextField
        label="Email"
        icon={Mail}
        type="email"
        value={form.email}
        onChange={e => set('email', e.target.value)}
        placeholder="you@university.edu"
        required
        autoComplete="email"
        inputRef={firstFieldRef}
      />

      <TextField
        label="Password"
        icon={Lock}
        revealable
        value={form.password}
        onChange={e => set('password', e.target.value)}
        placeholder="Your password"
        required
        autoComplete="current-password"
        labelAction={
          <button type="button" className="auth-forgot-link" onClick={onForgot}>
            Forgot password?
          </button>
        }
      />

      <motion.div variants={fieldVariants}>
        <SubmitButton loading={loading} label="Sign in" loadingLabel="Signing in…" />
      </motion.div>
    </form>
  );
}
