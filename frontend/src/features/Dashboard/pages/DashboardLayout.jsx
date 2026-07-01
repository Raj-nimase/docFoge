import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import useAuthStore from '@/contexts/authStore/authStore';
import {
  LayoutDashboard,
  Copy,
  History,
  Settings,
  Bell,
  Sparkles,
  X,
  GraduationCap,
  ChevronRight,
  Menu,
  CheckCircle,
  LogOut,
  LogIn
} from 'lucide-react';
import { GUEST_TRIAL_DAYS } from '@/utils/guestTrial';

const TAB_LABELS = {
  '/': 'dashboard',
  '/templates': 'templates',
  '/exports': 'exports',
  '/settings': 'settings',
};

export default function DashboardLayout({ onNewProject, onLogout, onSignIn }) {
  const { t } = useTranslation();
  const location = useLocation();

  const user            = useAuthStore(s => s.user);
  const authStatus      = useAuthStore(s => s.status);
  const getInitials     = useAuthStore(s => s.getInitials);
  const getTrialLabel   = useAuthStore(s => s.getTrialLabel);
  const isGuest         = authStatus === 'guest';
  const signedIn        = authStatus === 'authenticated';
  const trialLabel      = getTrialLabel();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);

  const activeLabel = TAB_LABELS[location.pathname] || 'dashboard';

  return (
    <div className="db-container">
      <aside className={`db-sidebar ${sidebarCollapsed ? 'db-sidebar--collapsed' : ''}`}>
        <div className="db-sidebar-top">
          <div className="sidebar-header">
            <button
              type="button"
              className="sidebar-logo"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title="Toggle sidebar"
              aria-expanded={!sidebarCollapsed}
            >
              <GraduationCap size={22} strokeWidth={2.2} />
            </button>
            <span className="sidebar-brand">{t('brand')}</span>
          </div>

          <nav className="sidebar-nav" aria-label="Main navigation">
            <NavLink to="/" end className="sidebar-nav-link">
              {({ isActive }) => (
                <span className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}>
                  <LayoutDashboard className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
                  <span className="sidebar-nav-item-label">{t('dashboard')}</span>
                </span>
              )}
            </NavLink>

            <NavLink to="/templates" className="sidebar-nav-link">
              {({ isActive }) => (
                <span className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}>
                  <Copy className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
                  <span className="sidebar-nav-item-label">{t('templates')}</span>
                </span>
              )}
            </NavLink>

            <NavLink to="/exports" className="sidebar-nav-link">
              {({ isActive }) => (
                <span className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}>
                  <History className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
                  <span className="sidebar-nav-item-label">{t('exports')}</span>
                </span>
              )}
            </NavLink>

            <NavLink to="/settings" className="sidebar-nav-link">
              {({ isActive }) => (
                <span className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}>
                  <Settings className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
                  <span className="sidebar-nav-item-label">{t('settings')}</span>
                </span>
              )}
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-profile">
          <div className="profile-avatar">{getInitials()}</div>
          <div className="profile-info">
            <span className="profile-name">{user?.name || 'Guest'}</span>
            <span className="profile-role">
              {isGuest
                ? (trialLabel
                  ? `${t('freeTrial', { defaultValue: 'Free trial' })} · ${trialLabel}`
                  : `${t('freeTrial', { defaultValue: 'Free trial' })} · ${GUEST_TRIAL_DAYS} ${t('days', { defaultValue: 'days' })}`)
                : ([user?.role, user?.institution].filter(Boolean).join(' · ') || user?.email)}
            </span>
          </div>
          {signedIn && onLogout ? (
            <button
              type="button"
              className="profile-logout-btn profile-signout-btn"
              title={t('signOut')}
              onClick={onLogout}
            >
              <LogOut size={15} />
              {!sidebarCollapsed && <span>{t('signOut')}</span>}
            </button>
          ) : isGuest && onSignIn ? (
            <button
              type="button"
              className="profile-logout-btn profile-signin-btn"
              title={t('signIn')}
              onClick={onSignIn}
            >
              <LogIn size={15} />
              {!sidebarCollapsed && <span>{t('signIn')}</span>}
            </button>
          ) : null}
        </div>
      </aside>

      <div className="db-main-viewport">
        {isGuest && trialLabel && (
          <div className="guest-trial-banner">
            <span>{t('guestTrialBanner', { trialLabel })}</span>
            {onSignIn && (
              <button type="button" className="btn-primary btn-sm" onClick={onSignIn}>
                {t('signInFree')}
              </button>
            )}
          </div>
        )}

        <header className="db-navbar">
          <div className="db-navbar-left">
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title="Toggle sidebar"
              aria-label="Toggle sidebar"
            >
              <Menu size={18} />
            </button>
            <nav className="db-breadcrumbs" aria-label="Breadcrumb">
              <span className="db-breadcrumbs-root">{t('workspace')}</span>
              <ChevronRight className="db-breadcrumbs-chevron" size={12} aria-hidden />
              <span className="active">{t(activeLabel)}</span>
            </nav>
          </div>

          <div className="db-navbar-right">
            {signedIn && onLogout && (
              <button
                type="button"
                className="nav-signout-btn db-navbar-signout"
                onClick={onLogout}
                title={t('signOut')}
              >
                <LogOut size={16} />
                <span>{t('signOut')}</span>
              </button>
            )}

            <div className="db-notifications-wrap">
              <button
                type="button"
                className="nav-icon-btn"
                onClick={() => setNotificationOpen(!notificationOpen)}
                title="Notifications"
                aria-expanded={notificationOpen}
                aria-haspopup="true"
              >
                <Bell size={18} />
                <span className="btn-badge" />
              </button>

              {notificationOpen && (
                <div className="db-notifications-panel modal-panel" role="dialog" aria-label={t('recentNotifications')}>
                  <div className="modal-header db-notifications-header">
                    <span className="modal-title">
                      <Bell size={13} /> {t('recentNotifications')}
                    </span>
                    <button
                      type="button"
                      className="modal-close"
                      onClick={() => setNotificationOpen(false)}
                      aria-label="Close notifications"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="modal-body db-notifications-body">
                    <div className="db-notification-item">
                      <CheckCircle size={13} className="db-notification-icon db-notification-icon--success" />
                      <span>
                        <b>{t('ieeeSizingTest', { defaultValue: 'IEEE Table Sizing Test' })}</b>{' '}
                        {t('notificationIeeeVuln')}
                      </span>
                    </div>
                    <div className="db-notification-item">
                      <Sparkles size={13} className="db-notification-icon" />
                      <span>
                        <b>{t('newAcademicTemplate', { defaultValue: 'New Academic Template' })}</b>{' '}
                        &quot;IEEE Conference layout&quot; {t('notificationTemplateLoaded')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="button" id="btn-new-project" className="btn-primary db-navbar-new" onClick={onNewProject}>
              {t('newProjectBtn')}
            </button>
          </div>
        </header>

        <div className="db-content-wrapper">
          <main className="db-scrollable-content" key={location.pathname}>
            <div className="db-page">
              <Outlet context={{ onNewProject, onLogout, onSignIn }} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
