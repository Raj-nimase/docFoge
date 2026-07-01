import { useState } from 'react';
import { GraduationCap, Mail, Lock, User, Building2, Briefcase, X } from 'lucide-react';
import useAuthStore from '@/contexts/authStore/authStore';
import { SketchHeroAccent, SketchUnderline } from '@/components/SketchDecor/SketchDecor';

export default function Auth({ trialExpired = false, allowDismiss = false, onDismiss, onSuccess }) {
  const register = useAuthStore(s => s.register);
  const login = useAuthStore(s => s.login);

  const [mode, setMode] = useState('login'); // login | register
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'Student',
    institution: '',
    department: '',
  });

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await register({ ...form, email: form.email.trim() });
      } else {
        await login(form.email, form.password);
      }
      await onSuccess?.();
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="auth-page"
    >
      <div className="auth-card">
        <SketchHeroAccent className="auth-card-sketch" />
        {allowDismiss && onDismiss && (
          <button type="button" className="auth-dismiss" onClick={onDismiss} aria-label="Close">
            <X size={18} />
          </button>
        )}
        <div
          className="auth-brand"
        >
          <GraduationCap size={32} strokeWidth={2} style={{ color: 'var(--accent-warm)' }} />
          <h1 className="display-heading">AcaDoc Pro</h1>
          <SketchUnderline className="auth-brand-underline" />
          <p>
            {trialExpired
              ? 'Your free trial has ended. Sign in or create an account to keep working.'
              : 'Sign in to save projects to the cloud and sync across devices'}
          </p>
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${mode === 'login' ? ' auth-tab--active' : ''}`}
            onClick={() => { setMode('login'); setError(''); }}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`auth-tab${mode === 'register' ? ' auth-tab--active' : ''}`}
            onClick={() => { setMode('register'); setError(''); }}
          >
            Create account
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode === 'register' && (
            <>
              <label className="auth-field">
                <span>Full name</span>
                <div className="auth-input-wrap">
                  <User size={16} />
                  <input
                    type="text"
                    value={form.name}
                    onChange={e => set('name', e.target.value)}
                    placeholder="Your name"
                    required
                    autoComplete="name"
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Role</span>
                <div className="auth-input-wrap">
                  <Briefcase size={16} />
                  <select value={form.role} onChange={e => set('role', e.target.value)}>
                    <option>Student</option>
                    <option>Faculty</option>
                    <option>Researcher</option>
                    <option>Administrator</option>
                  </select>
                </div>
              </label>

              <label className="auth-field">
                <span>Institution</span>
                <div className="auth-input-wrap">
                  <Building2 size={16} />
                  <input
                    type="text"
                    value={form.institution}
                    onChange={e => set('institution', e.target.value)}
                    placeholder="University or college"
                    autoComplete="organization"
                  />
                </div>
              </label>

              <label className="auth-field">
                <span>Department</span>
                <div className="auth-input-wrap">
                  <input
                    type="text"
                    value={form.department}
                    onChange={e => set('department', e.target.value)}
                    placeholder="e.g. Computer Science"
                  />
                </div>
              </label>
            </>
          )}

          <label className="auth-field">
            <span>Email</span>
            <div className="auth-input-wrap">
              <Mail size={16} />
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                placeholder="you@university.edu"
                required
                autoComplete="email"
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="auth-input-wrap">
              <Lock size={16} />
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'}
                required
                minLength={mode === 'login' ? undefined : 8}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              />
            </div>
          </label>

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="btn-primary auth-submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
