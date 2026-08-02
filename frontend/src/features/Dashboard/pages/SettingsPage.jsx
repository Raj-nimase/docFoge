import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import useAuthStore from '@/contexts/authStore/authStore';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { LogOut, KeyRound, Check } from 'lucide-react';
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
  const { onLogout, onSignIn } = useOutletContext();

  const user            = useAuthStore(s => s.user);
  const authStatus      = useAuthStore(s => s.status);
  const getTrialLabel   = useAuthStore(s => s.getTrialLabel);
  const updateProfile   = useAuthStore(s => s.updateProfile);
  const changePassword  = useAuthStore(s => s.changePassword);
  const isGuest         = authStatus === 'guest';
  const signedIn        = authStatus === 'authenticated';
  const trialLabel      = getTrialLabel();

  const showToast = useAcaStore(s => s.showToast);

  const [profileForm, setProfileForm] = useState({
    name: '',
    role: '',
    institution: '',
    department: '',
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [passwordSaved, setPasswordSaved] = useState(false);

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
      role: user.role || '',
      institution: user.institution || '',
      department: user.department || '',
    });
  }, [user]);

  // Guest view
  if (isGuest) {
    return (
      <motion.div variants={pageVariants} initial="hidden" animate="show">
        <motion.div className="dashboard-section-title" variants={itemVariants}>
          {t('accountSection')}
        </motion.div>
        <motion.div className="settings-card" variants={itemVariants}>
          <p className="modal-desc">
            {t('settingsGuestDesc')}
            {trialLabel && <>{t('settingsGuestTrialLabel', { trialLabel })}</>}
          </p>
          {onSignIn && (
            <motion.button type="button" className="btn-primary" onClick={onSignIn} whileTap={{ scale: 0.96 }}>
              {t('signInOrCreate')}
            </motion.button>
          )}
        </motion.div>
      </motion.div>
    );
  }

  // Authenticated view
  return (
    <motion.div className="settings-stack" variants={pageVariants} initial="hidden" animate="show">
      <motion.section variants={itemVariants}>
        <div className="dashboard-section-title">{t('accountProfile')}</div>
        <div className="settings-card">
          <div className="metadata-field">
            <label className="metadata-label">{t('fullName')}</label>
            <input
              type="text"
              className="metadata-input"
              value={profileForm.name}
              onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div className="metadata-field">
            <label className="metadata-label">{t('email')}</label>
            <input type="email" className="metadata-input" value={user?.email || ''} disabled />
          </div>
          <div className="metadata-field">
            <label className="metadata-label">{t('role')}</label>
            <select
              className="metadata-input"
              style={{ width: '100%' }}
              value={profileForm.role}
              onChange={e => setProfileForm(f => ({ ...f, role: e.target.value }))}
            >
              <option>{t('student')}</option>
              <option>{t('faculty')}</option>
              <option>{t('researcher')}</option>
              <option>{t('administrator')}</option>
            </select>
          </div>
          <div className="metadata-field">
            <label className="metadata-label">{t('institution')}</label>
            <input
              type="text"
              className="metadata-input"
              value={profileForm.institution}
              onChange={e => setProfileForm(f => ({ ...f, institution: e.target.value }))}
            />
          </div>
          <div className="metadata-field">
            <label className="metadata-label">{t('department')}</label>
            <input
              type="text"
              className="metadata-input"
              value={profileForm.department}
              onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))}
            />
          </div>
          <div className="settings-card-footer">
            <motion.button
              className="btn-primary"
              disabled={savingProfile}
              whileTap={{ scale: 0.97 }}
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
          </div>
        </div>
      </motion.section>

      <motion.section variants={itemVariants}>
        <div className="dashboard-section-title dashboard-section-title--icon">
          <KeyRound size={18} /> {t('changePassword', { defaultValue: 'Change Password' })}
        </div>
        <div className="settings-card">
          <div className="metadata-field">
            <label className="metadata-label">{t('currentPassword', { defaultValue: 'Current Password' })}</label>
            <input
              type="password"
              className="metadata-input"
              value={passwordForm.currentPassword}
              onChange={e => setPasswordForm(p => ({ ...p, currentPassword: e.target.value }))}
              placeholder={t('enterCurrentPassword', { defaultValue: 'Enter current password' })}
            />
          </div>
          <div className="metadata-field">
            <label className="metadata-label">{t('newPassword', { defaultValue: 'New Password' })}</label>
            <input
              type="password"
              className="metadata-input"
              value={passwordForm.newPassword}
              onChange={e => setPasswordForm(p => ({ ...p, newPassword: e.target.value }))}
              placeholder={t('passwordMinLength', { defaultValue: 'At least 8 characters' })}
            />
          </div>
          <div className="metadata-field">
            <label className="metadata-label">{t('confirmNewPassword', { defaultValue: 'Confirm New Password' })}</label>
            <input
              type="password"
              className="metadata-input"
              value={passwordForm.confirmPassword}
              onChange={e => setPasswordForm(p => ({ ...p, confirmPassword: e.target.value }))}
              placeholder={t('reenterNewPassword', { defaultValue: 'Re-enter new password' })}
            />
          </div>
          <div className="settings-card-footer">
            <motion.button
              className="btn-primary"
              disabled={updatingPassword}
              whileTap={{ scale: 0.97 }}
              onClick={async () => {
                if (!passwordForm.currentPassword || !passwordForm.newPassword) {
                  showToast('error', 'Please fill in all password fields');
                  return;
                }
                if (passwordForm.newPassword !== passwordForm.confirmPassword) {
                  showToast('error', 'New passwords do not match');
                  return;
                }
                if (passwordForm.newPassword.length < 8) {
                  showToast('error', 'New password must be at least 8 characters');
                  return;
                }
                setUpdatingPassword(true);
                try {
                  await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
                  showToast('success', 'Password updated successfully');
                  setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
                  flashSaved(setPasswordSaved);
                } catch (err) {
                  showToast('error', err.message);
                } finally {
                  setUpdatingPassword(false);
                }
              }}
            >
              <MorphLabel stateKey={updatingPassword ? 'updating' : passwordSaved ? 'saved' : 'idle'}>
                {updatingPassword
                  ? t('updatingPassword', { defaultValue: 'Updating...' })
                  : passwordSaved
                    ? <><Check size={14} /> {t('updatedLabel', { defaultValue: 'Updated' })}</>
                    : t('updatePassword', { defaultValue: 'Update Password' })}
              </MorphLabel>
            </motion.button>
          </div>

          {signedIn && onLogout && (
            <button
              type="button"
              className="btn-ghost nav-signout-btn nav-signout-btn--block"
              style={{ marginTop: 24 }}
              onClick={onLogout}
            >
              <LogOut size={15} style={{ marginRight: 6 }} />
              {t('signOut')}
            </button>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
