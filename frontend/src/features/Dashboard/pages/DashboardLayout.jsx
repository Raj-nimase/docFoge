import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import useAuthStore from '@/contexts/authStore/authStore';
import {
  LayoutDashboard,
  Star,
  Trash2,
  Settings,
  Bell,
  Sparkles,
  X,
  GraduationCap,
  ChevronRight,
  Menu,
  CheckCircle,
  LogOut,
  LogIn,
  FileText
} from 'lucide-react';
import { GUEST_TRIAL_DAYS } from '@/utils/guestTrial';
import {
  EASE,
  SPRING_PILL,
  SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSED,
  dropdownVariants,
  gridVariants,
  itemVariants,
} from '../dashboardMotion';

const TAB_LABELS = {
  '/': 'dashboard',
  '/starred': 'starred',
  '/trash': 'trash',
  '/settings': 'settings',
};

const NAV_ITEMS = [
  { to: '/', end: true, icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/starred', icon: Star, labelKey: 'starred' },
  { to: '/trash', icon: Trash2, labelKey: 'trash' },
  { to: '/settings', icon: Settings, labelKey: 'settings' },
];

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

  const notificationsRef = useRef(null);
  const bellRef = useRef(null);

  const activeLabel = TAB_LABELS[location.pathname] || 'dashboard';

  // Close notifications on outside click / Escape (Escape refocuses the bell)
  useEffect(() => {
    if (!notificationOpen) return;
    const onPointerDown = (e) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target)) {
        setNotificationOpen(false);
      }
    };
    const onKeyDown = (e) => {
      if (e.key === 'Escape') {
        setNotificationOpen(false);
        bellRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notificationOpen]);

  const collapsibleLabel = {
    animate: {
      opacity: sidebarCollapsed ? 0 : 1,
      x: sidebarCollapsed ? -8 : 0,
    },
    // collapse: fade out fast (before the width narrows past the text);
    // expand: let the width open first, then ease the labels in
    transition: sidebarCollapsed
      ? { duration: 0.12, ease: EASE }
      : { duration: 0.25, ease: EASE, delay: 0.1 },
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="db-container">
        <motion.aside
          className={`db-sidebar ${sidebarCollapsed ? 'db-sidebar--collapsed' : ''}`}
          initial={false}
          animate={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED : SIDEBAR_WIDTH }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <div className="db-sidebar-top">
            <div className="sidebar-header">
              <motion.button
                type="button"
                className="sidebar-logo"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title="Toggle sidebar"
                aria-expanded={!sidebarCollapsed}
                whileTap={{ scale: 0.92 }}
              >
                <GraduationCap size={22} strokeWidth={2.2} />
              </motion.button>
              <motion.span className="sidebar-brand" {...collapsibleLabel}>
                {t('brand')}
              </motion.span>
            </div>

            <nav className="sidebar-nav" aria-label="Main navigation">
              {NAV_ITEMS.map(({ to, end, icon: Icon, labelKey }) => {
                const label = labelKey === 'pdfTester'
                  ? t('pdfTester', { defaultValue: 'PDF Tester' })
                  : t(labelKey);
                return (
                  <NavLink
                    key={to}
                    to={to}
                    end={end}
                    className="sidebar-nav-link"
                    data-tooltip={label}
                  >
                    {({ isActive }) => (
                      <span className={`sidebar-nav-item ${isActive ? 'sidebar-nav-item--active' : ''}`}>
                        {isActive && (
                          <motion.span
                            layoutId="sidebar-active-pill"
                            className="sidebar-active-pill"
                            transition={SPRING_PILL}
                          />
                        )}
                        <Icon className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
                        <motion.span className="sidebar-nav-item-label" {...collapsibleLabel}>
                          {label}
                        </motion.span>
                      </span>
                    )}
                  </NavLink>
                );
              })}
            </nav>
          </div>

          <div className="sidebar-profile">
            <div className="profile-avatar">{getInitials()}</div>
            <motion.div className="profile-info" {...collapsibleLabel}>
              <span className="profile-name">{user?.name || 'Guest'}</span>
              <span className="profile-role">
                {isGuest
                  ? (trialLabel
                    ? `${t('freeTrial', { defaultValue: 'Free trial' })} · ${trialLabel}`
                    : `${t('freeTrial', { defaultValue: 'Free trial' })} · ${GUEST_TRIAL_DAYS} ${t('days', { defaultValue: 'days' })}`)
                  : ([user?.role, user?.institution].filter(Boolean).join(' · ') || user?.email)}
              </span>
            </motion.div>
            {signedIn && onLogout ? (
              <motion.button
                type="button"
                className="profile-logout-btn profile-signout-btn"
                title={t('signOut')}
                onClick={onLogout}
                whileTap={{ scale: 0.95 }}
              >
                <LogOut size={15} />
                {!sidebarCollapsed && <span>{t('signOut')}</span>}
              </motion.button>
            ) : isGuest && onSignIn ? (
              <motion.button
                type="button"
                className="profile-logout-btn profile-signin-btn"
                title={t('signIn')}
                onClick={onSignIn}
                whileTap={{ scale: 0.95 }}
              >
                <LogIn size={15} />
                {!sidebarCollapsed && <span>{t('signIn')}</span>}
              </motion.button>
            ) : null}
          </div>
        </motion.aside>

        <div className="db-main-viewport">
          {isGuest && trialLabel && (
            <motion.div
              className="guest-trial-banner"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, ease: EASE }}
            >
              <span>{t('guestTrialBanner', { trialLabel })}</span>
              {onSignIn && (
                <motion.button
                  type="button"
                  className="btn-primary btn-sm"
                  onClick={onSignIn}
                  whileTap={{ scale: 0.95 }}
                >
                  {t('signInFree')}
                </motion.button>
              )}
            </motion.div>
          )}

          <header className="db-navbar">
            <div className="db-navbar-left">
              <motion.button
                type="button"
                className="sidebar-toggle-btn"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                title="Toggle sidebar"
                aria-label="Toggle sidebar"
                aria-expanded={!sidebarCollapsed}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.92 }}
              >
                <Menu size={18} />
              </motion.button>
              <nav className="db-breadcrumbs" aria-label="Breadcrumb">
                <span className="db-breadcrumbs-root">{t('workspace')}</span>
                <ChevronRight className="db-breadcrumbs-chevron" size={12} aria-hidden />
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={activeLabel}
                    className="active"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.18, ease: EASE }}
                  >
                    {t(activeLabel)}
                  </motion.span>
                </AnimatePresence>
              </nav>
            </div>

            <div className="db-navbar-right">
              {signedIn && onLogout && (
                <motion.button
                  type="button"
                  className="nav-signout-btn db-navbar-signout"
                  onClick={onLogout}
                  title={t('signOut')}
                  whileTap={{ scale: 0.95 }}
                >
                  <LogOut size={16} />
                  <span>{t('signOut')}</span>
                </motion.button>
              )}

              <div className="db-notifications-wrap" ref={notificationsRef}>
                <motion.button
                  type="button"
                  className="nav-icon-btn"
                  onClick={() => setNotificationOpen(!notificationOpen)}
                  title="Notifications"
                  aria-expanded={notificationOpen}
                  aria-haspopup="true"
                  ref={bellRef}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.92 }}
                >
                  <Bell size={18} />
                  <span className="btn-badge" />
                </motion.button>

                <AnimatePresence>
                  {notificationOpen && (
                    <motion.div
                      className="db-notifications-panel modal-panel"
                      role="dialog"
                      aria-label={t('recentNotifications')}
                      variants={dropdownVariants}
                      initial="hidden"
                      animate="show"
                      exit="exit"
                    >
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
                      <motion.div
                        className="modal-body db-notifications-body"
                        variants={gridVariants}
                        initial="hidden"
                        animate="show"
                      >
                        <motion.div className="db-notification-item" variants={itemVariants}>
                          <CheckCircle size={13} className="db-notification-icon db-notification-icon--success" />
                          <span>
                            <b>{t('ieeeSizingTest', { defaultValue: 'IEEE Table Sizing Test' })}</b>{' '}
                            {t('notificationIeeeVuln')}
                          </span>
                        </motion.div>
                        <motion.div className="db-notification-item" variants={itemVariants}>
                          <Sparkles size={13} className="db-notification-icon" />
                          <span>
                            <b>{t('newAcademicTemplate', { defaultValue: 'New Academic Template' })}</b>{' '}
                            &quot;IEEE Conference layout&quot; {t('notificationTemplateLoaded')}
                          </span>
                        </motion.div>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <motion.button
                type="button"
                id="btn-new-project"
                className="btn-primary db-navbar-new"
                onClick={onNewProject}
                whileTap={{ scale: 0.95 }}
              >
                {t('newProjectBtn')}
              </motion.button>
            </div>
          </header>

          <div className="db-content-wrapper">
            <main className="db-scrollable-content" key={location.pathname}>
              <motion.div
                className="db-page"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <Outlet context={{ onNewProject, onLogout, onSignIn }} />
              </motion.div>
            </main>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
