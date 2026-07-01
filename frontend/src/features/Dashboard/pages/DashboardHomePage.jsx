import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import useAcaStore from '@/contexts/projectStore/projectStore';
import useAuthStore from '@/contexts/authStore/authStore';
import {
  Sparkles,
  BookOpen,
  Folder,
  FileText,
  ShieldCheck,
  Pin,
  Trash2,
  GraduationCap,
  Search,
  HelpCircle,
  X
} from 'lucide-react';
import { getTemplate, getTemplateIcon, formatDate } from './dashboardUtils.jsx';
import { SketchHeroAccent, SketchUnderline, SketchDocument } from '@/components/SketchDecor/SketchDecor';

export default function DashboardHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { onNewProject } = useOutletContext();

  const projects      = useAcaStore(s => s.projects);
  const openProject   = useAcaStore(s => s.openProject);
  const deleteProject = useAcaStore(s => s.deleteProject);

  const user       = useAuthStore(s => s.user);
  const authStatus = useAuthStore(s => s.status);
  const isGuest    = authStatus === 'guest';
  const signedIn   = authStatus === 'authenticated';
  const firstName  = user?.name?.trim().split(/\s+/)[0] || null;

  const welcomeTitle = signedIn && firstName
    ? t('welcomeBackUser', { firstName })
    : isGuest
      ? t('welcomeAcaDoc')
      : t('welcomeBack');
  const welcomeSubtitle = signedIn
    ? t('subtitleSignedIn')
    : t('subtitleGuest');

  const [searchQuery, setSearchQuery]       = useState('');
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [pinnedProjects, setPinnedProjects] = useState(() => new Map());

  const filteredProjects = useMemo(() => {
    return projects.filter(p => {
      const titleMatch = (p.metadata?.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase());
      const authorMatch = (p.metadata?.authors || '').toLowerCase().includes(searchQuery.toLowerCase());
      const tplMatch = (getTemplate(p.templateId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || authorMatch || tplMatch;
    });
  }, [projects, searchQuery]);

  const handleOpen = (projectId) => {
    openProject(projectId);
    navigate('/editor');
  };

  const handleDeleteConfirm = (id) => {
    deleteProject(id);
    setConfirmDelete(null);
  };

  const togglePin = (id, e) => {
    e.stopPropagation();
    if (typeof id !== 'string' || ['__proto__', 'constructor', 'prototype'].includes(id)) {
      return;
    }
    setPinnedProjects(prev => {
      const next = new Map(prev);
      next.set(id, !prev.get(id));
      return next;
    });
  };

  return (
    <>
      {/* Hero Welcome banner */}
      <div className="db-hero">
        <SketchHeroAccent className="db-hero-sketch" />
        <h2 className="db-hero-welcome display-heading">
          {welcomeTitle}
          <SketchUnderline />
        </h2>
        <p className="db-hero-subtitle">{welcomeSubtitle}</p>
        <div className="db-hero-actions">
          <button type="button" className="btn-primary" onClick={onNewProject}>
            <Sparkles size={14} /> {t('newProjectHero')}
          </button>
          <button type="button" className="btn-ghost" onClick={() => navigate('/templates')}>
            <BookOpen size={14} /> {t('browseTemplatesHero')}
          </button>
        </div>
      </div>

      {/* Stats Section */}
      <div
        className="db-stats-grid"
      >
        <div className="stats-card">
          <div className="stats-card-header">
            <span className="stats-card-title">{t('totalPapers')}</span>
            <Folder className="stats-card-icon" size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value">{projects.length}</span>
            <span className="stats-trend stats-trend--up">↑ 12%</span>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="stats-card-title">{t('pdfsGenerated')}</span>
            <FileText className="stats-card-icon" size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value">{projects.length * 3 + 2}</span>
            <span className="stats-trend stats-trend--up">↑ 24%</span>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="stats-card-title">{t('aiFormatting')}</span>
            <Sparkles className="stats-card-icon" size={18} strokeWidth={2} style={{ color: 'var(--accent)' }} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value">16</span>
            <span className="stats-trend stats-trend--up">↑ 8%</span>
          </div>
        </div>

        <div className="stats-card">
          <div className="stats-card-header">
            <span className="stats-card-title">{t('latexHealth')}</span>
            <ShieldCheck className="stats-card-icon" size={18} strokeWidth={2} style={{ color: '#22c55e' }} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value">100%</span>
            <span className="stats-trend stats-trend--up" style={{ color: '#22c55e' }}>{t('perfect')}</span>
          </div>
        </div>
      </div>

      {/* Projects Header with Search */}
      <div className="project-toolbar">
        <div className="dashboard-section-title">
          {searchQuery ? t('searchResults', { count: filteredProjects.length }) : t('recentProjects')}
        </div>
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
      </div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <div className="dashboard-empty">
          <div className="dashboard-empty-illustration">
            <SketchDocument className="dashboard-empty-sketch" size={72} />
          </div>
          <h2 className="dashboard-empty-title display-heading">{t('emptyTitle')}</h2>
          <p className="dashboard-empty-desc">
            {t('emptyDesc')}
          </p>
          <button className="btn-primary btn-large" onClick={onNewProject}>
            {t('newProjectBtn')}
          </button>
        </div>
      ) : (
        <div className="projects-grid">
          {/* Add block trigger */}
          <button
            className="project-card project-card--new"
            onClick={onNewProject}
          >
            <span className="project-card-new-icon">
              <Folder size={32} strokeWidth={1.5} />
            </span>
            <span className="project-card-new-label">{t('createWorkspace')}</span>
          </button>

          {/* Filtered Project Cards */}
          <>
            {filteredProjects.map(project => {
              const tpl = getTemplate(project.templateId);
              const isPinned = !!pinnedProjects.get(project.id);
              return (
                <div
                  key={project.id}
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
                    title={isPinned ? t('unpinProject') : t('pinProject')}
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
                        {t('byAuthor', { author: project.metadata.authors })}
                      </div>
                    )}
                    <div className="project-card-date">
                      {t('modifiedDate', { date: formatDate(project.updatedAt) })}
                    </div>
                  </div>
                  <div className="project-card-actions">
                    <button className="btn-primary btn-sm" onClick={() => handleOpen(project.id)}>
                      {t('openWorkspace')}
                    </button>
                    <button
                      className="btn-ghost btn-sm btn-danger-hover"
                      onClick={() => setConfirmDelete(project.id)}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        </div>
      )}

      {/* Delete confirmation modal */}
      <>
        {confirmDelete && (
          <div
            className="modal-backdrop"
            onClick={() => setConfirmDelete(null)}
          >
            <div
              className="modal-panel"
              style={{ maxWidth: 420 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <HelpCircle size={15} style={{ color: 'var(--error)' }} /> {t('deleteWorkspaceTitle')}
                </span>
                <button className="modal-close" onClick={() => setConfirmDelete(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <p style={{ color: 'var(--text-muted)', marginBottom: 20, fontSize: '0.82rem', lineHeight: 1.5 }}>
                  {t('deleteWorkspaceConfirm')}
                </p>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>{t('cancel')}</button>
                  <button
                    className="btn-primary"
                    style={{ background: 'var(--error)', borderColor: 'var(--error)' }}
                    onClick={() => handleDeleteConfirm(confirmDelete)}
                  >
                    {t('confirmDelete')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    </>
  );
}
