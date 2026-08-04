import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import useAuthStore from '@/contexts/authStore/authStore';
import {
  Sparkles,
  BookOpen,
  Folder,
  FileText,
  Layers,
  Clock,
  Pin,
  Trash2,
  Search,
  HelpCircle,
  X,
  FileUp,
  FileType,
  AlertCircle,
  FileCheck,
  UploadCloud
} from 'lucide-react';
import { getTemplate, getTemplateIcon, formatDate } from './dashboardUtils.jsx';
import { SketchHeroAccent, SketchUnderline, SketchDocument } from '@/components/SketchDecor/SketchDecor';
import * as api from '@/services/api';
import { parseImportedHtmlIntoChapters } from '../utils/importParsing';
import {
  EASE,
  pageVariants,
  itemVariants,
  gridVariants,
  cardVariants,
  hoverLift,
  backdropVariants,
  modalVariants,
} from '../dashboardMotion';

const statHover = { y: -3, transition: { duration: 0.2, ease: EASE } };

function getGreetingKey() {
  const hour = new Date().getHours();
  if (hour < 12) return ['goodMorning', 'Good morning'];
  if (hour < 18) return ['goodAfternoon', 'Good afternoon'];
  return ['goodEvening', 'Good evening'];
}

export default function DashboardHomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { onNewProject } = useOutletContext();

  const projects         = useAcaStore(s => s.projects);
  const openProject      = useAcaStore(s => s.openProject);
  const trashProject     = useAcaStore(s => s.trashProject);
  const togglePinProject = useAcaStore(s => s.togglePinProject);
  const createProject    = useAcaStore(s => s.createProject);

  const user       = useAuthStore(s => s.user);
  const authStatus = useAuthStore(s => s.status);
  const isGuest    = authStatus === 'guest';
  const signedIn   = authStatus === 'authenticated';
  const firstName  = user?.name?.trim().split(/\s+/)[0] || null;

  const [greetingKey, greetingDefault] = getGreetingKey();

  const welcomeTitle = signedIn && firstName
    ? t('welcomeBackUser', { firstName })
    : isGuest
      ? t('welcomeAcaDoc')
      : t('welcomeBack');
  const welcomeSubtitle = signedIn
    ? t('subtitleSignedIn')
    : t('subtitleGuest');

  const [searchQuery, setSearchQuery]     = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importTitle, setImportTitle] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const createImportedProject = useAcaStore(s => s.createImportedProject);

  // Filter active (non-trashed) projects
  const activeProjects = useMemo(() => {
    return projects.filter(p => !p.deletedAt);
  }, [projects]);

  // Honest stats derived from real active project data
  const stats = useMemo(() => {
    const chapterCount = activeProjects.reduce((n, p) => n + (p.chapters?.length || 0), 0);
    const templatesUsed = new Set(activeProjects.map(p => p.templateId).filter(Boolean)).size;
    const lastActivity = activeProjects.length
      ? formatDate(Math.max(...activeProjects.map(p => p.updatedAt || 0)))
      : '—';
    return { chapterCount, templatesUsed, lastActivity };
  }, [activeProjects]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.name.toLowerCase().endsWith('.pdf')) {
      setError('PDF extraction is coming soon! Only Microsoft Word (.docx) files are supported for now.');
      setImportFile(null);
      return;
    }

    setError(null);
    setImportFile(file);
    const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    setImportTitle(baseName);
  };

  const handleImportSubmit = async () => {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    try {
      const result = await api.uploadDocument(importFile);
      if (!result.success || (!result.html && !result.text)) {
        throw new Error(result.error || 'Failed to extract content from the file.');
      }

      const chaptersList = parseImportedHtmlIntoChapters(result.html || result.text, importTitle);
      createImportedProject(importTitle, chaptersList);
      setShowImportModal(false);
      // Reset state
      setImportFile(null);
      setImportTitle('');
      navigate('/editor');
    } catch (err) {
      setError(err.message || 'Import failed.');
    } finally {
      setImporting(false);
    }
  };

  const filteredProjects = useMemo(() => {
    const list = activeProjects.filter(p => {
      const titleMatch = (p.metadata?.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase());
      const authorMatch = (p.metadata?.authors || '').toLowerCase().includes(searchQuery.toLowerCase());
      const tplMatch = (getTemplate(p.templateId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || authorMatch || tplMatch;
    });

    return list.sort((a, b) => {
      const aPinned = !!(a.isPinned || a.pinned);
      const bPinned = !!(b.isPinned || b.pinned);
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return (b.updatedAt || 0) - (a.updatedAt || 0);
    });
  }, [activeProjects, searchQuery]);

  const handleOpen = (projectId) => {
    openProject(projectId);
    navigate('/editor');
  };

  const handleDeleteConfirm = (id) => {
    trashProject(id);
    setConfirmDelete(null);
  };

  const togglePin = (id, e) => {
    e.stopPropagation();
    togglePinProject(id);
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="hidden"
      animate="show"
    >
      {/* Hero Welcome banner */}
      <motion.div className="db-hero" variants={itemVariants}>
        <SketchHeroAccent className="db-hero-sketch" />
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '4px 12px', borderRadius: 99, background: 'rgba(99, 102, 241, 0.08)', border: '1px solid rgba(99, 102, 241, 0.18)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--accent)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 8px var(--accent)' }} />
          {t(greetingKey, { defaultValue: greetingDefault })} • Academic Workspace
        </div>
        <h2 className="db-hero-welcome display-heading">
          {welcomeTitle}
          <SketchUnderline />
        </h2>
        <p className="db-hero-subtitle">{welcomeSubtitle}</p>
        <div className="db-hero-actions">
          <motion.button type="button" className="btn-primary" onClick={onNewProject} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
            <Sparkles size={14} /> {t('newProjectHero')}
          </motion.button>
          <motion.button
            type="button"
            className="btn-secondary"
            onClick={() => setShowImportModal(true)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.96 }}
          >
            <FileText size={14} /> {t('importDocument', { defaultValue: 'Import Document' })}
          </motion.button>
        </div>
      </motion.div>

      {/* Stats Section — real numbers only */}
      <motion.div className="db-stats-grid" variants={itemVariants}>
        <motion.div className="stats-card" whileHover={statHover}>
          <div className="stats-card-header">
            <span className="stats-card-title">{t('totalPapers')}</span>
            <Folder className="stats-card-icon" size={18} strokeWidth={2} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value">{projects.length}</span>
            <span className="stats-caption">{t('acrossWorkspace', { defaultValue: 'in your workspace' })}</span>
          </div>
        </motion.div>

        <motion.div className="stats-card" whileHover={statHover}>
          <div className="stats-card-header">
            <span className="stats-card-title">{t('chaptersWritten', { defaultValue: 'Chapters' })}</span>
            <BookOpen className="stats-card-icon" size={18} strokeWidth={2} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value">{stats.chapterCount}</span>
            <span className="stats-caption">{t('acrossAllProjects', { defaultValue: 'across all projects' })}</span>
          </div>
        </motion.div>

        <motion.div className="stats-card" whileHover={statHover}>
          <div className="stats-card-header">
            <span className="stats-card-title">{t('templatesUsed', { defaultValue: 'Templates used' })}</span>
            <Layers className="stats-card-icon" size={18} strokeWidth={2} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value">{stats.templatesUsed}</span>
            <span className="stats-caption">{t('distinctTemplates', { defaultValue: 'distinct formats' })}</span>
          </div>
        </motion.div>

        <motion.div className="stats-card" whileHover={statHover}>
          <div className="stats-card-header">
            <span className="stats-card-title">{t('lastActivity', { defaultValue: 'Last activity' })}</span>
            <Clock className="stats-card-icon" size={18} strokeWidth={2} />
          </div>
          <div className="stats-card-body">
            <span className="stats-value stats-value--date">{stats.lastActivity}</span>
            <span className="stats-caption">{t('latestEdit', { defaultValue: 'latest edit' })}</span>
          </div>
        </motion.div>
      </motion.div>

      {/* Projects Header with Search */}
      <motion.div className="project-toolbar" variants={itemVariants}>
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
          <AnimatePresence>
            {searchQuery && (
              <motion.button
                type="button"
                className="search-clear"
                aria-label={t('clearSearch', { defaultValue: 'Clear search' })}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.15, ease: EASE }}
                onClick={() => setSearchQuery('')}
              >
                <X size={12} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Empty State */}
      {projects.length === 0 ? (
        <motion.div className="dashboard-empty" variants={itemVariants}>
          <div className="dashboard-empty-illustration">
            <SketchDocument className="dashboard-empty-sketch" size={72} />
          </div>
          <h2 className="dashboard-empty-title display-heading">{t('emptyTitle')}</h2>
          <p className="dashboard-empty-desc">
            {t('emptyDesc')}
          </p>
          <div className="dashboard-empty-actions">
            <motion.button className="btn-primary btn-large" onClick={onNewProject} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.96 }}>
              {t('newProjectBtn')}
            </motion.button>
            <motion.button
              className="btn-secondary btn-large"
              onClick={() => setShowImportModal(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.96 }}
            >
              <FileText size={16} /> {t('importDocument', { defaultValue: 'Import Document' })}
            </motion.button>
          </div>
        </motion.div>
      ) : filteredProjects.length === 0 ? (
        <motion.div className="dashboard-empty" variants={itemVariants} style={{ padding: '48px 24px' }}>
          <Search size={40} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>No documents found</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: 16 }}>No papers match "{searchQuery}". Try searching for another keyword or template.</p>
          <button className="btn-secondary btn-sm" onClick={() => setSearchQuery('')}>Clear Search</button>
        </motion.div>
      ) : (
        <motion.div className="projects-grid" variants={gridVariants}>
          {/* Add block trigger */}
          <motion.button
            variants={cardVariants}
            whileHover={hoverLift}
            className="project-card project-card--new"
            onClick={onNewProject}
          >
            <span className="project-card-new-icon">
              <Folder size={32} strokeWidth={1.5} />
            </span>
            <span className="project-card-new-label">{t('createWorkspace')}</span>
          </motion.button>

          {/* Import file card trigger */}
          <motion.button
            variants={cardVariants}
            whileHover={hoverLift}
            className="project-card project-card--new project-card--import"
            onClick={() => setShowImportModal(true)}
          >
            <span className="project-card-new-icon project-card-new-icon--accent">
              <FileText size={32} strokeWidth={1.5} />
            </span>
            <span className="project-card-new-label">{t('importDocument', { defaultValue: 'Import Document' })}</span>
          </motion.button>

          {/* Filtered Project Cards */}
          <AnimatePresence>
            {filteredProjects.map(project => {
              const tpl = getTemplate(project.templateId);
              const isPinned = !!(project.isPinned || project.pinned);
              const chapterCount = project.chapters?.length || 0;
              return (
                <motion.div
                  key={project.id}
                  variants={cardVariants}
                  exit="exit"
                  whileHover={hoverLift}
                  className={`project-card${isPinned ? ' project-card--pinned' : ''}`}
                >
                  <motion.button
                    type="button"
                    className={`project-card-pin${isPinned ? ' project-card-pin--active' : ''}`}
                    onClick={(e) => togglePin(project.id, e)}
                    whileTap={{ scale: 0.85 }}
                    aria-pressed={isPinned}
                    title={isPinned ? t('unpinProject') : t('pinProject')}
                  >
                    <Pin size={15} style={{ transform: 'rotate(45deg)' }} />
                  </motion.button>

                  <div className="project-card-icon">
                    {getTemplateIcon(tpl?.icon)}
                  </div>
                  <div className="project-card-body">
                    <div className="project-card-title">
                      {project.metadata?.title || 'Untitled Draft'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2, marginBottom: 4, flexWrap: 'wrap' }}>
                      <span className="project-card-template" style={{ margin: 0 }}>
                        {tpl?.name || 'Blank Template'}
                      </span>
                      {chapterCount > 0 && (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(99, 102, 241, 0.08)', color: 'var(--accent)', fontWeight: 600 }}>
                          {chapterCount} {chapterCount === 1 ? 'Ch.' : 'Chs.'}
                        </span>
                      )}
                      {isPinned && (
                        <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'rgba(217, 119, 6, 0.14)', color: 'var(--accent-warm)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <Pin size={9} style={{ transform: 'rotate(45deg)' }} /> Pinned
                        </span>
                      )}
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
                    <motion.button className="btn-primary btn-sm" onClick={() => handleOpen(project.id)} whileTap={{ scale: 0.96 }}>
                      {t('openWorkspace')}
                    </motion.button>
                    <motion.button
                      className="btn-ghost btn-sm btn-danger-hover project-card-delete"
                      onClick={() => setConfirmDelete(project.id)}
                      whileTap={{ scale: 0.9 }}
                      aria-label={t('deleteWorkspaceTitle')}
                    >
                      <Trash2 size={13} />
                    </motion.button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals with AnimatePresence */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => setConfirmDelete(null)}
          >
            <motion.div
              className="modal-panel"
              variants={modalVariants}
              style={{ maxWidth: 420 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title dashboard-section-title--icon">
                  <HelpCircle size={15} style={{ color: 'var(--error)' }} /> {t('deleteWorkspaceTitle')}
                </span>
                <button className="modal-close" onClick={() => setConfirmDelete(null)}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  {t('deleteWorkspaceConfirm')}
                </p>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>{t('cancel')}</button>
                  <motion.button
                    className="btn-danger"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handleDeleteConfirm(confirmDelete)}
                  >
                    {t('confirmDelete')}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {showImportModal && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => !importing && setShowImportModal(false)}
          >
            <motion.div
              className="modal-panel"
              variants={modalVariants}
              style={{ maxWidth: 520, padding: 24 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header" style={{ marginBottom: 16 }}>
                <span className="modal-title dashboard-section-title--icon" style={{ fontSize: '1.05rem' }}>
                  <FileUp size={18} style={{ color: 'var(--accent)' }} /> {t('importDocument', { defaultValue: 'Import Document' })}
                </span>
                <button className="modal-close" onClick={() => !importing && setShowImportModal(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-desc" style={{ marginBottom: 16, lineHeight: 1.55, fontSize: '0.88rem' }}>
                  {t('importDescription', { defaultValue: 'Upload a Microsoft Word document. We will automatically extract the content, split sections into chapters, and build your editable workspace.' })}
                </p>

                {/* Format Support Pills */}
                <div className="import-format-pills" style={{ marginBottom: 20 }}>
                  <span className="import-format-pill import-format-pill--active">
                    <span className="word-icon-badge">W</span> Word (.docx) Supported
                  </span>
                  <span className="import-format-pill import-format-pill--disabled">
                    <AlertCircle size={11} /> PDF Extraction (Coming Soon)
                  </span>
                </div>

                {/* Project Title Input */}
                <div className="metadata-field" style={{ marginBottom: 18 }}>
                  <label className="metadata-label" style={{ marginBottom: 6 }}>{t('projectTitle', { defaultValue: 'Project Title' })}</label>
                  <input
                    type="text"
                    className="metadata-input"
                    value={importTitle}
                    onChange={e => setImportTitle(e.target.value)}
                    placeholder="e.g. Research Manuscript"
                    disabled={importing}
                  />
                </div>

                {/* File Input container */}
                <div className="metadata-field" style={{ marginBottom: 8 }}>
                  <label className="metadata-label" style={{ marginBottom: 6 }}>{t('selectFile', { defaultValue: 'Select Word File (.docx)' })}</label>
                  <div
                    className={`import-dropzone${importFile ? ' import-dropzone--has-file' : ''}`}
                    onClick={() => !importing && document.getElementById('import-file-input').click()}
                  >
                    <input
                      id="import-file-input"
                      type="file"
                      accept=".docx,.doc,.txt"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      disabled={importing}
                    />
                    {importFile ? (
                      <div className="import-selected-card">
                        <span className="word-icon-large">W</span>
                        <div className="import-selected-meta">
                          <div className="import-dropzone-name">{importFile.name}</div>
                          <div className="import-dropzone-hint">{(importFile.size / 1024).toFixed(1)} KB • Microsoft Word Document</div>
                        </div>
                        <span className="import-change-btn">Change</span>
                      </div>
                    ) : (
                      <div className="import-empty-dropzone">
                        <span className="word-icon-large">W</span>
                        <div className="import-dropzone-title">{t('clickToSelectFile', { defaultValue: 'Click to choose Word (.docx) file' })}</div>
                        <div className="import-dropzone-hint">{t('supportedFormats', { defaultValue: 'Supports Microsoft Word (.docx, .doc)' })}</div>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div className="import-error">
                    <AlertCircle size={14} /> {error}
                  </div>
                )}

                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => setShowImportModal(false)} disabled={importing}>
                    {t('cancel')}
                  </button>
                  <motion.button
                    className="btn-primary"
                    onClick={handleImportSubmit}
                    disabled={!importFile || !importTitle.trim() || importing}
                    whileTap={{ scale: 0.96 }}
                  >
                    {importing ? (
                      <span className="preview-compile-spinner" style={{ width: 12, height: 12 }} />
                    ) : null}
                    {importing
                      ? t('importing', { defaultValue: 'Importing...' })
                      : t('import', { defaultValue: 'Import' })}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );

}
