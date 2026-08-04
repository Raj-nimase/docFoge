import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import useAuthStore from '@/contexts/authStore/authStore';
import useAcaStore from '@/contexts/projectStore/projectStore';
import {
  LogOut,
  Check,
  User,
  Mail,
  Briefcase,
  Building2,
  GraduationCap,
  ShieldCheck
} from 'lucide-react';
import { pageVariants, itemVariants } from '../dashboardMotion';

/* Button label that morphs between idle / busy / saved states */
function MorphLabel({ stateKey, children }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.span
        key={stateKey}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.15 }}
      >
        {children}
      </motion.span>
    </AnimatePresence>
  );
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { onLogout } = useOutletContext();

  const user          = useAuthStore(s => s.user);
  const authStatus    = useAuthStore(s => s.status);
  const updateProfile = useAuthStore(s => s.updateProfile);
  const getInitials   = useAuthStore(s => s.getInitials);
  const signedIn      = authStatus === 'authenticated';

  const showToast = useAcaStore(s => s.showToast);

  const [profileForm, setProfileForm] = useState({
    name: '',
    role: '',
    institution: '',
    department: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const savedTimers = useRef([]);
  useEffect(() => () => savedTimers.current.forEach(clearTimeout), []);

  const flashSaved = (setter) => {
    setter(true);
    savedTimers.current.push(setTimeout(() => setter(false), 1600));
  };

  useEffect(() => {
    if (!user) return;
    setProfileForm({
      name: user.name || '',
      role: user.role || 'Student',
      institution: user.institution || '',
      department: user.department || '',
    });
  }, [user]);

  // Authenticated view
  return (
    <motion.div className="settings-stack" variants={pageVariants} initial="hidden" animate="show" style={{ maxWidth: 880 }}>
      {/* Header Profile Hero Card */}
      <motion.div className="settings-card settings-hero-card" variants={itemVariants}>
        <div className="settings-hero-avatar">
          {getInitials()}
        </div>
        <div className="settings-hero-info">
          <div className="settings-hero-name-row">
            <h2 className="settings-hero-name">{user?.name || 'Academic User'}</h2>
            <span className="settings-hero-badge">
              <ShieldCheck size={12} /> Verified Account
            </span>
          </div>
          <p className="settings-hero-email">{user?.email}</p>
          <div className="settings-hero-meta">
            <span>Role: <b>{profileForm.role || 'Member'}</b></span>
            {user?.institution && <span>• {user.institution}</span>}
          </div>
        </div>
      </motion.div>

      {/* Account Profile Card */}
      <motion.section variants={itemVariants}>
        <div className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <User size={18} style={{ color: 'var(--accent)' }} /> {t('accountProfile')}
        </div>

        <div className="settings-card settings-form-card">
          <div className="settings-form-grid">
            {/* Full Name */}
            <div className="metadata-field">
              <label className="metadata-label">
                <User size={14} /> {t('fullName')}
              </label>
              <input
                type="text"
                className="metadata-input"
                value={profileForm.name}
                onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>

            {/* Email Address */}
            <div className="metadata-field">
              <label className="metadata-label">
                <Mail size={14} /> {t('email')}
              </label>
              <input
                type="email"
                className="metadata-input metadata-input--disabled"
                value={user?.email || ''}
                disabled
              />
            </div>

            {/* Academic Role */}
            <div className="metadata-field">
              <label className="metadata-label">
                <Briefcase size={14} /> {t('role')}
              </label>
              <select
                className="metadata-input"
                style={{ width: '100%' }}
                value={profileForm.role}
                onChange={e => setProfileForm(f => ({ ...f, role: e.target.value }))}
              >
                <option value="Student">{t('student')}</option>
                <option value="Faculty">{t('faculty')}</option>
                <option value="Researcher">{t('researcher')}</option>
                <option value="Administrator">{t('administrator')}</option>
              </select>
            </div>

            {/* Institution */}
            <div className="metadata-field">
              <label className="metadata-label">
                <Building2 size={14} /> {t('institution')}
              </label>
              <input
                type="text"
                className="metadata-input"
                value={profileForm.institution}
                onChange={e => setProfileForm(f => ({ ...f, institution: e.target.value }))}
                placeholder="University or Research Institute"
              />
            </div>

            {/* Department */}
            <div className="metadata-field" style={{ gridColumn: 'span 2' }}>
              <label className="metadata-label">
                <GraduationCap size={14} /> {t('department')}
              </label>
              <input
                type="text"
                className="metadata-input"
                value={profileForm.department}
                onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))}
                placeholder="Department of Computer Science, Physics..."
              />
            </div>
          </div>

          <div className="settings-card-footer">
            <motion.button
              className="btn-primary"
              disabled={savingProfile}
              whileTap={{ scale: 0.97 }}
              whileHover={{ scale: 1.01 }}
              onClick={async () => {
                setSavingProfile(true);
                try {
                  await updateProfile(profileForm);
                  showToast('success', 'Profile updated');
                  flashSaved(setProfileSaved);
                } catch (err) {
                  showToast('error', err.message);
                } finally {
                  setSavingProfile(false);
                }
              }}
            >
              <MorphLabel stateKey={savingProfile ? 'saving' : profileSaved ? 'saved' : 'idle'}>
                {savingProfile
                  ? t('savingProfile')
                  : profileSaved
                    ? <><Check size={14} /> {t('savedLabel', { defaultValue: 'Saved' })}</>
                    : t('saveProfile')}
              </MorphLabel>
            </motion.button>

            {signedIn && onLogout && (
              <motion.button
                type="button"
                className="btn-ghost nav-signout-btn profile-page-signout"
                onClick={onLogout}
                whileTap={{ scale: 0.96 }}
              >
                <LogOut size={14} style={{ marginRight: 6 }} />
                {t('signOut')}
              </motion.button>
            )}
          </div>
        </div>
      </motion.section>
    </motion.div>
  );
}
