import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'motion/react';
import useAuthStore from '@/contexts/authStore/authStore';
import useLenis from '@/hooks/useLenis';
import {
  LayoutDashboard,
  Star,
  Trash2,
  Settings,
  Sparkles,
  X,
  GraduationCap,
  ChevronRight,
  Menu,
  LogOut,
  FileText
} from 'lucide-react';
import {
  EASE,
  SPRING_PILL,
  SIDEBAR_WIDTH,
  SIDEBAR_COLLAPSED,
  gridVariants,
  itemVariants,
} from '../dashboardMotion';

const TAB_LABELS = {
  '/dashboard': 'dashboard',
  '/dashboard/starred': 'starred',
  '/dashboard/trash': 'trash',
  '/dashboard/settings': 'settings',
};

const NAV_ITEMS = [
  { to: '/dashboard', end: true, icon: LayoutDashboard, labelKey: 'dashboard' },
  { to: '/dashboard/starred', icon: Star, labelKey: 'starred' },
  { to: '/dashboard/trash', icon: Trash2, labelKey: 'trash' },
  { to: '/dashboard/settings', icon: Settings, labelKey: 'settings' },
];

export default function DashboardLayout({ onNewProject, onLogout }) {
  const { t } = useTranslation();
  const location = useLocation();

  const user            = useAuthStore(s => s.user);
  const authStatus      = useAuthStore(s => s.status);
  const getInitials     = useAuthStore(s => s.getInitials);
  const signedIn        = authStatus === 'authenticated';

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Smooth scrolling for the main content area. The element is keyed by
  // pathname (remounts on navigation), so re-create Lenis per route.
  const scrollWrapRef = useRef(null);
  useLenis({ wrapperRef: scrollWrapRef, deps: [location.pathname] });

  const activeLabel = TAB_LABELS[location.pathname] || 'dashboard';

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
            <div className="profile-user-row">
              <div className="profile-avatar">{getInitials()}</div>
              <motion.div className="profile-info" {...collapsibleLabel}>
                <span className="profile-name" title={user?.name || 'Guest'}>
                  {user?.name || 'Guest'}
                </span>
                <span
                  className="profile-role"
                  title={[user?.role, user?.institution].filter(Boolean).join(' · ') || user?.email}
                >
                  {[user?.role, user?.institution].filter(Boolean).join(' · ') || user?.email}
                </span>
              </motion.div>
            </div>
            {signedIn && onLogout && (
              <motion.button
                type="button"
                className="profile-signout-btn"
                title={t('signOut')}
                onClick={onLogout}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.95 }}
              >
                <LogOut size={14} />
                {!sidebarCollapsed && <span>{t('signOut')}</span>}
              </motion.button>
            )}
          </div>
        </motion.aside>

        <div className="db-main-viewport">
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
            <main className="db-scrollable-content" key={location.pathname} ref={scrollWrapRef}>
              <motion.div
                className="db-page"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: EASE }}
              >
                <Outlet context={{ onNewProject, onLogout }} />
              </motion.div>
            </main>
          </div>
        </div>
      </div>
    </MotionConfig>
  );
}
