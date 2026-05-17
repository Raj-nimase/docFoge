import { useState, useMemo } from 'react';
import useAcaStore from '../store';
import { TEMPLATES } from '../lib/templates';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Copy,
  History,
  Settings,
  Search,
  Bell,
  Sparkles,
  BookOpen,
  Folder,
  FileText,
  ShieldCheck,
  Pin,
  Trash2,
  Lightbulb,
  X,
  GraduationCap,
  FileCode,
  Files,
  ChevronRight,
  Menu,
  CheckCircle,
  HelpCircle
} from 'lucide-react';

const TEMPLATE_MAP = Object.fromEntries(TEMPLATES.map(t => [t.id, t]));

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

function getTemplateIcon(iconStr, className = "") {
  const props = { className, size: 28, strokeWidth: 1.8, style: { color: 'var(--accent)' } };
  switch (iconStr) {
    case '🎓':
      return <GraduationCap {...props} />;
    case '📄':
      return <FileText {...props} />;
    case '📚':
      return <BookOpen {...props} />;
    case '📝':
      return <FileCode {...props} />;
    case '📃':
      return <Files {...props} />;
    default:
      return <FileText {...props} />;
  }
}

export default function Dashboard({ onNewProject, onOpenProject }) {
  const projects      = useAcaStore(s => s.projects);
  const openProject   = useAcaStore(s => s.openProject);
  const deleteProject = useAcaStore(s => s.deleteProject);
  
  // Custom States
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab]               = useState('dashboard'); // 'dashboard' | 'templates' | 'exports' | 'settings'
  const [searchQuery, setSearchQuery]           = useState('');
  const [confirmDelete, setConfirmDelete]       = useState(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [pinnedProjects, setPinnedProjects]     = useState({});

  // Memoized Search & Filter Projects
  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const titleMatch = (p.metadata?.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase());
      const authorMatch = (p.metadata?.authors || '').toLowerCase().includes(searchQuery.toLowerCase());
      const tplMatch = (TEMPLATE_MAP[p.templateId]?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || authorMatch || tplMatch;
    });
  }, [projects, searchQuery]);

  const handleOpen = (projectId) => {
    openProject(projectId);
    onOpenProject();
  };

  const handleDeleteConfirm = (id) => {
    deleteProject(id);
    setConfirmDelete(null);
  };

  const togglePin = (id, e) => {
    e.stopPropagation();
    setPinnedProjects(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Stagger configurations for child entries
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } }
  };

  return (
    <div className="db-container">
      {/* 1. COLLAPSIBLE SIDEBAR */}
      <aside className={`db-sidebar ${sidebarCollapsed ? 'db-sidebar--collapsed' : ''}`} style={{ transition: 'width 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)' }}>
        <div>
          <div className="sidebar-header">
            <button className="sidebar-logo" onClick={() => setSidebarCollapsed(!sidebarCollapsed)} title="Toggle Sidebar">
              <GraduationCap size={22} strokeWidth={2.2} style={{ color: 'var(--accent)' }} />
            </button>
            <span className="sidebar-brand">AcaDoc Pro</span>
          </div>

          <nav className="sidebar-nav">
            <motion.button
              whileHover={{ x: 4 }}
              className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'sidebar-nav-item--active' : ''}`}
              onClick={() => setActiveTab('dashboard')}
            >
              <LayoutDashboard className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
              <span className="sidebar-nav-item-label">Dashboard</span>
            </motion.button>
            
            <motion.button
              whileHover={{ x: 4 }}
              className={`sidebar-nav-item ${activeTab === 'templates' ? 'sidebar-nav-item--active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              <Copy className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
              <span className="sidebar-nav-item-label">Templates</span>
            </motion.button>
            
            <motion.button
              whileHover={{ x: 4 }}
              className={`sidebar-nav-item ${activeTab === 'exports' ? 'sidebar-nav-item--active' : ''}`}
              onClick={() => setActiveTab('exports')}
            >
              <History className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
              <span className="sidebar-nav-item-label">Export History</span>
            </motion.button>

            <motion.button
              whileHover={{ x: 4 }}
              className={`sidebar-nav-item ${activeTab === 'settings' ? 'sidebar-nav-item--active' : ''}`}
              onClick={() => setActiveTab('settings')}
            >
              <Settings className="sidebar-nav-item-icon" size={17} strokeWidth={2} />
              <span className="sidebar-nav-item-label">Settings</span>
            </motion.button>
          </nav>
        </div>

        {/* User Profile Card */}
        <div className="sidebar-profile">
          <div className="profile-avatar">SJ</div>
          <div className="profile-info">
            <span className="profile-name">Sarah Jenkins</span>
            <span className="profile-role">University Principal</span>
          </div>
        </div>
      </aside>

      {/* 2. MAIN VIEWPORT */}
      <div className="db-main-viewport">
        {/* Top Navbar */}
        <header className="db-navbar">
          <div className="db-navbar-left">
            <button
              className="sidebar-toggle-btn"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title="Toggle sidebar"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <Menu size={18} />
            </button>
            <div className="db-breadcrumbs">
              <span>Workspace</span>
              <span className="breadcrumb-sep">
                <ChevronRight size={10} style={{ color: 'var(--text-faint)' }} />
              </span>
              <span className="active">
                {activeTab === 'dashboard' && 'Dashboard'}
                {activeTab === 'templates' && 'Templates'}
                {activeTab === 'exports' && 'Exports'}
                {activeTab === 'settings' && 'Settings'}
              </span>
            </div>
          </div>

          <div className="db-navbar-right">
            {/* Search inputs */}
            {activeTab === 'dashboard' && (
              <div className="search-container">
                <Search className="search-icon" size={14} />
                <input
                  type="text"
                  className="search-input"
                  placeholder="Search papers, templates..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            )}

            {/* Notification Bell */}
            <button
              className="nav-icon-btn"
              onClick={() => setNotificationOpen(!notificationOpen)}
              title="Notifications"
              style={{ position: 'relative' }}
            >
              <Bell size={18} />
              <span className="btn-badge"></span>
            </button>

            {/* Notification Dropdown modal simulation */}
            <AnimatePresence>
              {notificationOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="modal-panel"
                  style={{
                    position: 'absolute',
                    top: 60,
                    right: 80,
                    maxWidth: 320,
                    zIndex: 200,
                    boxShadow: '0 10px 30px rgba(0,0,0,0.1)'
                  }}
                >
                  <div className="modal-header" style={{ padding: '10px 14px' }}>
                    <span className="modal-title" style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Bell size={13} style={{ color: 'var(--accent)' }} /> Recent Notifications
                    </span>
                    <button className="modal-close" onClick={() => setNotificationOpen(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <X size={12} />
                    </button>
                  </div>
                  <div className="modal-body" style={{ padding: 12, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <CheckCircle size={13} style={{ color: '#4ade80', flexShrink: 0, marginTop: 2 }} />
                      <span><b>IEEE Table Sizing Test</b> successfully compiled to PDF format.</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                      <Sparkles size={13} style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 2 }} />
                      <span><b>New Academic Template</b> "IEEE Conference layout" was loaded.</span>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button id="btn-new-project" className="btn-primary" onClick={onNewProject}>
              + New Project
            </button>
          </div>
        </header>

        {/* Scrollable Main Area */}
        <div className="db-content-wrapper">
          <AnimatePresence mode="wait">
            <motion.main
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="db-scrollable-content"
            >
              
              {/* ───── TAB 1: DASHBOARD VIEW ───── */}
              {activeTab === 'dashboard' && (
                <>
                  {/* Hero Welcome banner */}
                  <motion.div
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.05, type: 'spring', stiffness: 200 }}
                    className="db-hero"
                  >
                    <h2 className="db-hero-welcome">Welcome back, Sarah!</h2>
                    <p className="db-hero-subtitle">
                      Transform unstructured flat inputs into professional, publication-ready LaTeX documents instantly. Realize academic perfection.
                    </p>
                    <div className="db-hero-actions">
                      <button className="btn-primary" onClick={onNewProject} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={14} /> Start AI Assistant
                      </button>
                      <button className="btn-ghost" style={{ borderColor: 'rgba(255,255,255,0.2)', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={() => setActiveTab('templates')}>
                        <BookOpen size={14} /> Browse Templates
                      </button>
                    </div>
                  </motion.div>

                  {/* Stats Section */}
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="db-stats-grid"
                  >
                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stats-card">
                      <div className="stats-card-header">
                        <span className="stats-card-title">Total Papers</span>
                        <Folder className="stats-card-icon" size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div className="stats-card-body">
                        <span className="stats-value">{projects.length}</span>
                        <span className="stats-trend stats-trend--up">↑ 12%</span>
                      </div>
                    </motion.div>

                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stats-card">
                      <div className="stats-card-header">
                        <span className="stats-card-title">PDFs Generated</span>
                        <FileText className="stats-card-icon" size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div className="stats-card-body">
                        <span className="stats-value">{projects.length * 3 + 2}</span>
                        <span className="stats-trend stats-trend--up">↑ 24%</span>
                      </div>
                    </motion.div>

                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stats-card">
                      <div className="stats-card-header">
                        <span className="stats-card-title">AI Formatting</span>
                        <Sparkles className="stats-card-icon" size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
                      </div>
                      <div className="stats-card-body">
                        <span className="stats-value">16</span>
                        <span className="stats-trend stats-trend--up">↑ 8%</span>
                      </div>
                    </motion.div>

                    <motion.div variants={itemVariants} whileHover={{ y: -4 }} className="stats-card">
                      <div className="stats-card-header">
                        <span className="stats-card-title">Latex Health</span>
                        <ShieldCheck className="stats-card-icon" size={18} strokeWidth={2} style={{ color: '#22c55e' }} />
                      </div>
                      <div className="stats-card-body">
                        <span className="stats-value">100%</span>
                        <span className="stats-trend stats-trend--up" style={{ color: '#22c55e' }}>Perfect</span>
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Projects Header */}
                  <div className="project-toolbar">
                    <div className="dashboard-section-title">
                      {searchQuery ? `Search Results (${filteredProjects.length})` : 'Recent Projects'}
                    </div>
                  </div>

                  {/* Empty State */}
                  {projects.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="dashboard-empty"
                      style={{ background: '#ffffff', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)' }}
                    >
                      <div className="dashboard-empty-illustration">
                        <GraduationCap size={64} strokeWidth={1.2} style={{ color: 'var(--accent)', opacity: 0.4 }} />
                      </div>
                      <h2 className="dashboard-empty-title">Assemble your first academic workspace</h2>
                      <p className="dashboard-empty-desc">
                        Create MSBTE reports, B.Tech theses, or standard IEEE research papers effortlessly without parsing manual TeX templates.
                      </p>
                      <button className="btn-primary btn-large" onClick={onNewProject}>
                        + Create New Project
                      </button>
                    </motion.div>
                  ) : (
                    <div className="projects-grid">
                      {/* Add block trigger */}
                      <motion.button
                        whileHover={{ scale: 1.01, y: -2 }}
                        className="project-card project-card--new"
                        onClick={onNewProject}
                        style={{ minHeight: 180 }}
                      >
                        <span className="project-card-new-icon" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Folder size={32} strokeWidth={1.5} style={{ color: 'var(--accent)', opacity: 0.6 }} />
                        </span>
                        <span className="project-card-new-label" style={{ marginTop: 8 }}>Create Workspace</span>
                      </motion.button>

                      {/* Filtered Project Cards */}
                      <AnimatePresence>
                        {filteredProjects.map(project => {
                          const tpl = TEMPLATE_MAP[project.templateId];
                          const isPinned = !!pinnedProjects[project.id];
                          return (
                            <motion.div
                              key={project.id}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              whileHover={{ y: -4, boxShadow: '0 12px 30px rgba(0,0,0,0.08)' }}
                              transition={{ duration: 0.15, ease: 'easeOut' }}
                              className="project-card"
                              style={{ position: 'relative' }}
                            >
                              
                              {/* Pin Toggle absolute */}
                              <button
                                onClick={(e) => togglePin(project.id, e)}
                                style={{
                                  position: 'absolute',
                                  top: 14,
                                  right: 14,
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  opacity: isPinned ? 1 : 0.25,
                                  transition: 'opacity 0.2s',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: isPinned ? 'var(--accent)' : 'inherit'
                                }}
                                title={isPinned ? 'Unpin project' : 'Pin project'}
                              >
                                <Pin size={15} style={{ transform: 'rotate(45deg)' }} />
                              </button>

                              <div className="project-card-icon">
                                {getTemplateIcon(tpl?.icon)}
                              </div>
                              <div className="project-card-body">
                                <div className="project-card-title">
                                  {project.metadata?.title || 'Untitled Draft'}
                                </div>
                                <div className="project-card-template">
                                  {tpl?.name || 'Blank Template'}
                                </div>
                                {project.metadata?.authors && (
                                  <div className="project-card-author">
                                    by {project.metadata.authors}
                                  </div>
                                )}
                                <div className="project-card-date">
                                  Modified {formatDate(project.updatedAt)}
                                </div>
                              </div>
                              <div className="project-card-actions">
                                <button className="btn-primary btn-sm" onClick={() => handleOpen(project.id)}>
                                  Open Workspace
                                </button>
                                <button
                                  className="btn-ghost btn-sm btn-danger-hover"
                                  onClick={() => setConfirmDelete(project.id)}
                                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </AnimatePresence>
                    </div>
                  )}
                </>
              )}

              {/* ───── TAB 2: TEMPLATE DIRECTORY ───── */}
              {activeTab === 'templates' && (
                <>
                  <div className="dashboard-section-title">Preconfigured Document Layouts</div>
                  <motion.div
                    variants={containerVariants}
                    initial="hidden"
                    animate="show"
                    className="template-picker-grid"
                    style={{ padding: 0 }}
                  >
                    {TEMPLATES.map(tpl => (
                      <motion.div
                        variants={itemVariants}
                        whileHover={{ y: -4, boxShadow: '0 8px 25px rgba(0,0,0,0.06)' }}
                        key={tpl.id}
                        className="template-card"
                        style={{ minHeight: 180, justifyContent: 'space-between' }}
                      >
                        <div>
                          <span className="template-card-icon">{getTemplateIcon(tpl.icon)}</span>
                          <div className="template-card-name" style={{ marginTop: 8 }}>{tpl.name}</div>
                          <div className="template-card-desc" style={{ fontSize: '0.75rem', marginTop: 4 }}>{tpl.description}</div>
                        </div>
                        <button className="btn-primary btn-sm" style={{ alignSelf: 'flex-start', marginTop: 12 }} onClick={onNewProject}>
                          Create Project
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                </>
              )}

              {/* ───── TAB 3: EXPORTS HISTORY ───── */}
              {activeTab === 'exports' && (
                <>
                  <div className="dashboard-section-title">Academic Export Logs</div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
                      <thead>
                        <tr style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: 8, color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px 12px' }}>Document</th>
                          <th>File Type</th>
                          <th>Compile Duration</th>
                          <th>Export Date</th>
                          <th style={{ textAlign: 'right', paddingRight: 12 }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px' }}><b>IEEE Table Sizing Test</b></td>
                          <td>LaTeX PDF</td>
                          <td>4.2 seconds</td>
                          <td>Today, 02:40 PM</td>
                          <td style={{ textAlign: 'right', paddingRight: 12 }}><button className="btn-ghost btn-xs">Download</button></td>
                        </tr>
                        <tr>
                          <td style={{ padding: '12px' }}><b>MSBTE Presentation</b></td>
                          <td>PDF Document</td>
                          <td>3.8 seconds</td>
                          <td>Yesterday, 11:15 AM</td>
                          <td style={{ textAlign: 'right', paddingRight: 12 }}><button className="btn-ghost btn-xs">Download</button></td>
                        </tr>
                      </tbody>
                    </table>
                  </motion.div>
                </>
              )}

              {/* ───── TAB 4: SETTINGS PANEL ───── */}
              {activeTab === 'settings' && (
                <>
                  <div className="dashboard-section-title">Workspace Configuration</div>
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, maxWidth: 640 }}
                  >
                    <div className="metadata-field" style={{ marginBottom: 16 }}>
                      <label className="metadata-label">Academic Institution</label>
                      <input type="text" className="metadata-input" defaultValue="Department of Computer Engineering" />
                    </div>
                    <div className="metadata-field" style={{ marginBottom: 16 }}>
                      <label className="metadata-label">Citation Default Engine</label>
                      <select className="metadata-input" style={{ width: '100%' }}>
                        <option>IEEE Citation standard</option>
                        <option>APA 7th Format</option>
                        <option>Harvard Referencing</option>
                      </select>
                    </div>
                    <div className="metadata-field" style={{ marginBottom: 20 }}>
                      <label className="metadata-label">Preferred Preamble Packages</label>
                      <textarea className="metadata-input" rows={4} defaultValue="\usepackage{amsmath}&#10;\usepackage{booktabs}&#10;\usepackage{graphicx}" />
                    </div>
                    <button className="btn-primary" onClick={() => alert('Settings Saved Successfully!')}>
                      Save Preferences
                    </button>
                  </motion.div>
                </>
              )}

            </motion.main>
          </AnimatePresence>

          {/* 3. RIGHT ACTIVITIES CONTEXT PANEL */}
          {activeTab === 'dashboard' && (
            <aside className="db-right-panel">
              <div className="right-panel-header">
                <span className="right-panel-title">Activity Timeline</span>
              </div>
              <div className="right-panel-content">
                <div className="timeline-list">
                  <div className="timeline-item">
                    <span className="timeline-dot timeline-dot--active"></span>
                    <span className="timeline-text">Compiled IEEE Sizing Test</span>
                    <span className="timeline-meta">2 mins ago</span>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-dot"></span>
                    <span className="timeline-text">Modified Introduction section</span>
                    <span className="timeline-meta">1 hour ago</span>
                  </div>
                  <div className="timeline-item">
                    <span className="timeline-dot"></span>
                    <span className="timeline-text">Created workspace from template</span>
                    <span className="timeline-meta">Yesterday, 04:30 PM</span>
                  </div>
                </div>

                <div className="ai-tip-card">
                  <div className="ai-tip-header" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Lightbulb size={13} style={{ color: 'var(--accent)' }} />
                    <span>AI Tip of the Day</span>
                  </div>
                  <p className="ai-tip-desc">
                    Use our equation formatting helpers to compile complex formulas without debugging mathematical LaTeX notation error codes.
                  </p>
                </div>
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="modal-backdrop"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              className="modal-panel"
              style={{ maxWidth: 420 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HelpCircle size={15} style={{ color: 'var(--error)' }} /> Delete Workspace?
                </span>
                <button className="modal-close" onClick={() => setConfirmDelete(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.82rem', lineHeight: 1.5 }}>
                  Are you sure you want to delete this workspace? This deletes all chapters, front matter notes, and LaTeX assets permanently.
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>Cancel</button>
                  <button
                    className="btn-primary"
                    style={{ background: 'var(--error)', borderColor: 'var(--error)' }}
                    onClick={() => handleDeleteConfirm(confirmDelete)}
                  >
                    Confirm Delete
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
