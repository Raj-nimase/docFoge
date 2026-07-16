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
import * as api from '@/services/api';

function convertTextToParagraphsAndLists(lines) {
  const blocks = [];
  let currentBlock = [];
  let currentType = 'paragraph'; // 'paragraph', 'bulletList', 'orderedList'

  const getLineType = (trimmedLine) => {
    if (/^[-*•]\s+/.test(trimmedLine)) return 'bulletList';
    if (/^\d+[.)]\s+/.test(trimmedLine)) return 'orderedList';
    return 'paragraph';
  };

  const flushBlock = () => {
    if (currentBlock.length === 0) return;
    
    if (currentType === 'bulletList') {
      blocks.push({
        type: 'bulletList',
        content: currentBlock.map(line => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: line.replace(/^[-*•]\s+/, '').trim() }]
            }
          ]
        }))
      });
    } else if (currentType === 'orderedList') {
      blocks.push({
        type: 'orderedList',
        content: currentBlock.map(line => ({
          type: 'listItem',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: line.replace(/^\d+[.)]\s+/, '').trim() }]
            }
          ]
        }))
      });
    } else {
      blocks.push({
        type: 'paragraph',
        content: [{ type: 'text', text: currentBlock.join(' ') }]
      });
    }
    currentBlock = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') {
      flushBlock();
      continue;
    }

    const type = getLineType(trimmed);
    if (type !== currentType) {
      flushBlock();
      currentType = type;
    }
    currentBlock.push(trimmed);
  }
  flushBlock();
  return blocks;
}

function parseImportedTextIntoChapters(text) {
  if (!text) return [];

  const lines = text.split('\n');
  const chapters = [];
  let currentChapterTitle = 'Introduction';
  let currentLines = [];

  const isHeading = (line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.length > 80) return false;
    
    // 1. All uppercase short headings (e.g. ABSTRACT, INTRODUCTION)
    const isShortUpper = trimmed === trimmed.toUpperCase() && trimmed.length < 50 && /[A-Z]/.test(trimmed);
    if (isShortUpper) return true;

    // 2. Chapter headings (e.g. Chapter 1, CHAPTER II)
    if (/^chapter\s+\d+/i.test(trimmed) || /^chapter\s+[ivxldcm]+/i.test(trimmed)) return true;

    // 3. Multi-level numbering (e.g. 1.1 Background, 2.1.3 Details)
    if (/^\d+\.\d+(\.\d+)*\.?\s+[A-Za-z]/.test(trimmed)) return true;

    // 4. Single-level numbering with Title Case (e.g. 1. Introduction, 2. Literature Review)
    // but not sentence case (e.g. 1. Step one)
    if (/^\d+[.)]\s+[A-Z][A-Za-z]*(\s+[A-Z][A-Za-z]*)*$/.test(trimmed)) return true;

    // 5. Common section names exactly (case-insensitive)
    const commonSectionNames = [
      'abstract', 'introduction', 'overview', 'background', 'literature review',
      'methodology', 'methods', 'implementation', 'results', 'evaluation',
      'discussion', 'conclusion', 'conclusions', 'future work', 'references', 'appendix'
    ];
    if (commonSectionNames.includes(trimmed.toLowerCase())) return true;

    return false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (isHeading(trimmed)) {
      const hasTextContent = currentLines.some(l => l.trim() !== '');
      if (hasTextContent || chapters.length > 0) {
        chapters.push({
          title: currentChapterTitle,
          content: {
            type: 'doc',
            content: convertTextToParagraphsAndLists(currentLines)
          }
        });
      }
      currentChapterTitle = trimmed;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }

  const hasTextContent = currentLines.some(l => l.trim() !== '');
  if (hasTextContent || chapters.length === 0) {
    chapters.push({
      title: currentChapterTitle,
      content: {
        type: 'doc',
        content: convertTextToParagraphsAndLists(currentLines)
      }
    });
  }

  return chapters;
}

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

  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importTitle, setImportTitle] = useState('');
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState(null);

  const createImportedProject = useAcaStore(s => s.createImportedProject);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
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
      if (!result.success || !result.text) {
        throw new Error(result.error || 'Failed to extract text from the file.');
      }

      const chaptersList = parseImportedTextIntoChapters(result.text);
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
          <button type="button" className="btn-secondary" onClick={() => setShowImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(255, 255, 255, 0.1)', borderColor: 'rgba(255, 255, 255, 0.2)', color: '#fff' }}>
            <FileText size={14} /> Import Document
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
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <button className="btn-primary btn-large" onClick={onNewProject}>
              {t('newProjectBtn')}
            </button>
            <button className="btn-secondary btn-large" onClick={() => setShowImportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <FileText size={16} /> Import Document
            </button>
          </div>
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

          {/* Import file card trigger */}
          <button
            className="project-card project-card--new"
            onClick={() => setShowImportModal(true)}
            style={{ borderStyle: 'dashed', borderColor: 'var(--border)' }}
          >
            <span className="project-card-new-icon" style={{ color: 'var(--accent)' }}>
              <FileText size={32} strokeWidth={1.5} />
            </span>
            <span className="project-card-new-label">Import Document</span>
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

      {/* Import Document Modal */}
      <>
        {showImportModal && (
          <div className="modal-backdrop" onClick={() => !importing && setShowImportModal(false)}>
            <div className="modal-panel" style={{ maxWidth: 500 }} onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Sparkles size={15} style={{ color: 'var(--accent)' }} /> Import Document
                </span>
                <button className="modal-close" onClick={() => !importing && setShowImportModal(false)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5, margin: 0 }}>
                  Upload a PDF, DOCX, or text file. We will extract the text, split it into chapters automatically, and create a workspace for you to edit.
                </p>

                {/* Project Title Input */}
                <div className="metadata-field">
                  <label className="metadata-label">Project Title</label>
                  <input
                    type="text"
                    className="metadata-input"
                    value={importTitle}
                    onChange={e => setImportTitle(e.target.value)}
                    placeholder="e.g. My Imported Document"
                    disabled={importing}
                  />
                </div>

                {/* File Input container */}
                <div className="metadata-field">
                  <label className="metadata-label">Select File (.pdf, .docx, .txt)</label>
                  <div style={{
                    border: '2px dashed var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '24px 16px',
                    textAlign: 'center',
                    cursor: importing ? 'default' : 'pointer',
                    background: 'var(--bg)',
                    position: 'relative'
                  }}
                  onClick={() => !importing && document.getElementById('import-file-input').click()}
                  >
                    <input
                      id="import-file-input"
                      type="file"
                      accept=".pdf,.docx,.txt,.md"
                      onChange={handleFileChange}
                      style={{ display: 'none' }}
                      disabled={importing}
                    />
                    {importFile ? (
                      <div>
                        <FileText size={28} style={{ color: 'var(--accent)', marginBottom: 8 }} />
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
                          {importFile.name}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          {(importFile.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Folder size={28} style={{ color: 'var(--text-muted)', marginBottom: 8 }} />
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          Click to select file
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                          Supports PDF, Word (DOCX), Text (TXT)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {error && (
                  <div style={{ color: 'var(--error)', fontSize: '0.8rem', marginTop: 4 }}>
                    ⚠️ {error}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                  <button className="btn-ghost" onClick={() => setShowImportModal(false)} disabled={importing}>
                    Cancel
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleImportSubmit}
                    disabled={!importFile || !importTitle.trim() || importing}
                    style={{ minWidth: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {importing ? (
                      <span className="preview-compile-spinner" style={{ width: 12, height: 12 }} />
                    ) : null}
                    {importing ? 'Importing...' : 'Import'}
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
