import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import useAuthStore from '@/contexts/authStore/authStore';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { LogOut } from 'lucide-react';

export default function SettingsPage() {
  const { t } = useTranslation();
  const { onLogout, onSignIn } = useOutletContext();

  const user            = useAuthStore(s => s.user);
  const authStatus      = useAuthStore(s => s.status);
  const getTrialLabel   = useAuthStore(s => s.getTrialLabel);
  const updateProfile   = useAuthStore(s => s.updateProfile);
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
      <>
        <div className="dashboard-section-title">{t('accountSection')}</div>
        <div
          style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 640 }}
        >
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.5 }}>
            {t('settingsGuestDesc')}
            {trialLabel && <>{t('settingsGuestTrialLabel', { trialLabel })}</>}
          </p>
          {onSignIn && (
            <button type="button" className="btn-primary" onClick={onSignIn}>
              {t('signInOrCreate')}
            </button>
          )}
        </div>
      </>
    );
  }

  // Authenticated view
  return (
    <>
      <div className="dashboard-section-title">{t('accountProfile')}</div>
      <div
        style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 640 }}
      >
        <div className="metadata-field" style={{ marginBottom: 16 }}>
          <label className="metadata-label">{t('fullName')}</label>
          <input
            type="text"
            className="metadata-input"
            value={profileForm.name}
            onChange={e => setProfileForm(f => ({ ...f, name: e.target.value }))}
          />
        </div>
        <div className="metadata-field" style={{ marginBottom: 16 }}>
          <label className="metadata-label">{t('email')}</label>
          <input type="email" className="metadata-input" value={user?.email || ''} disabled />
        </div>
        <div className="metadata-field" style={{ marginBottom: 16 }}>
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
        <div className="metadata-field" style={{ marginBottom: 16 }}>
          <label className="metadata-label">{t('institution')}</label>
          <input
            type="text"
            className="metadata-input"
            value={profileForm.institution}
            onChange={e => setProfileForm(f => ({ ...f, institution: e.target.value }))}
          />
        </div>
        <div className="metadata-field" style={{ marginBottom: 20 }}>
          <label className="metadata-label">{t('department')}</label>
          <input
            type="text"
            className="metadata-input"
            value={profileForm.department}
            onChange={e => setProfileForm(f => ({ ...f, department: e.target.value }))}
          />
        </div>
        <button
          className="btn-primary"
          disabled={savingProfile}
          onClick={async () => {
            setSavingProfile(true);
            try {
              await updateProfile(profileForm);
               showToast('success', 'Profile updated');
            } catch (err) {
              showToast('error', err.message);
            } finally {
              setSavingProfile(false);
            }
          }}
        >
          {savingProfile ? t('savingProfile') : t('saveProfile')}
        </button>
        {signedIn && onLogout && (
          <button
            type="button"
            className="btn-ghost nav-signout-btn nav-signout-btn--block"
            onClick={onLogout}
          >
            <LogOut size={15} style={{ marginRight: 6 }} />
            {t('signOut')}
          </button>
        )}
      </div>
    </>
  );
}
