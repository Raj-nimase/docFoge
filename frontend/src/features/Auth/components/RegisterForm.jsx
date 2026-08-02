import { useState } from 'react';
import { motion } from 'motion/react';
import { Mail, Lock, User, Building2, Briefcase } from 'lucide-react';
import TextField from './TextField';
import SubmitButton from './SubmitButton';
import { fieldVariants } from './authMotion';

const ROLES = ['Student', 'Faculty', 'Researcher', 'Administrator'];

export default function RegisterForm({ form, set, loading, onSubmit, firstFieldRef }) {
  const [mismatch, setMismatch] = useState(false);

  const checkMatch = () => {
    setMismatch(Boolean(form.confirmPassword) && form.password !== form.confirmPassword);
  };

  return (
    <form className="auth-form" onSubmit={onSubmit}>
      <motion.div className="auth-pane-heading" variants={fieldVariants}>
        <h2>Create your account</h2>
        <p>Save projects to the cloud and pick up anywhere.</p>
      </motion.div>

      <div className="auth-field-row">
        <TextField
          label="Full name"
          icon={User}
          value={form.name}
          onChange={e => set('name', e.target.value)}
          placeholder="Your name"
          required
          autoComplete="name"
          inputRef={firstFieldRef}
        />

        <motion.div className="auth-field" variants={fieldVariants}>
          <label className="auth-field-label-row">
            <span className="auth-field-label">Role</span>
          </label>
          <div className="auth-input-wrap">
            <Briefcase size={16} />
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
          </div>
        </motion.div>
      </div>

      <div className="auth-field-row">
        <TextField
          label="Institution"
          icon={Building2}
          value={form.institution}
          onChange={e => set('institution', e.target.value)}
          placeholder="University or college"
          autoComplete="organization"
        />

        <TextField
          label="Department"
          value={form.department}
          onChange={e => set('department', e.target.value)}
          placeholder="e.g. Computer Science"
        />
      </div>

      <TextField
        label="Email"
        icon={Mail}
        type="email"
        value={form.email}
        onChange={e => set('email', e.target.value)}
        placeholder="you@university.edu"
        required
        autoComplete="email"
      />

      <TextField
        label="Password"
        icon={Lock}
        revealable
        value={form.password}
        onChange={e => set('password', e.target.value)}
        placeholder="At least 8 characters"
        required
        minLength={8}
        autoComplete="new-password"
        hint="At least 8 characters"
        hintOk={form.password.length >= 8}
      />

      <TextField
        label="Confirm password"
        icon={Lock}
        revealable
        value={form.confirmPassword}
        onChange={e => set('confirmPassword', e.target.value)}
        onBlur={checkMatch}
        placeholder="Re-enter password"
        required
        minLength={8}
        autoComplete="new-password"
        hint={mismatch ? 'Passwords do not match' : undefined}
      />

      <motion.div variants={fieldVariants}>
        <SubmitButton loading={loading} label="Create account" loadingLabel="Creating account…" />
      </motion.div>
    </form>
  );
}
