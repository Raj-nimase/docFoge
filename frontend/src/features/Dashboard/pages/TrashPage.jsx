import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'motion/react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { Trash2, RotateCcw, AlertTriangle, X, Search, HelpCircle } from 'lucide-react';
import { getTemplate, getTemplateIcon, formatDate } from './dashboardUtils.jsx';
import { SketchDocument } from '@/components/SketchDecor/SketchDecor';
import {
  pageVariants,
  itemVariants,
  gridVariants,
  cardVariants,
  hoverLift,
  backdropVariants,
  modalVariants,
} from '../dashboardMotion';

export default function TrashPage() {
  const { t } = useTranslation();

  const projects = useAcaStore(s => s.projects);
  const restoreProject = useAcaStore(s => s.restoreProject);
  const permanentlyDeleteProject = useAcaStore(s => s.permanentlyDeleteProject);
  const emptyTrash = useAcaStore(s => s.emptyTrash);

  const [searchQuery, setSearchQuery] = useState('');
  const [confirmPermanent, setConfirmPermanent] = useState(null); // project id
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  // Trashed projects
  const trashedProjects = useMemo(() => {
    return projects.filter(p => p.deletedAt);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return trashedProjects.filter(p => {
      const titleMatch = (p.metadata?.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase());
      const authorMatch = (p.metadata?.authors || '').toLowerCase().includes(searchQuery.toLowerCase());
      const tplMatch = (getTemplate(p.templateId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || authorMatch || tplMatch;
    });
  }, [trashedProjects, searchQuery]);

  const handleEmptyTrash = () => {
    emptyTrash();
    setShowEmptyConfirm(false);
  };

  const handlePermanentDelete = (id) => {
    permanentlyDeleteProject(id);
    setConfirmPermanent(null);
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show">
      {/* Header with Search and Empty Trash button */}
      <motion.div className="project-toolbar" variants={itemVariants}>
        <div className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Trash2 size={18} style={{ color: 'var(--text-muted)' }} />
          {t('trash', { defaultValue: 'Trash Bin' })} ({trashedProjects.length})
        </div>
        {trashedProjects.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div className="search-container">
              <Search className="search-icon" size={14} />
              <input
                type="text"
                className="search-input"
                placeholder="Search trashed papers..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <motion.button
              type="button"
              className="btn-secondary btn-sm btn-danger-hover"
              onClick={() => setShowEmptyConfirm(true)}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 size={14} /> Empty Trash
            </motion.button>
          </div>
        )}
      </motion.div>

      {/* Empty State */}
      {trashedProjects.length === 0 ? (
        <motion.div className="dashboard-empty" variants={itemVariants}>
          <div className="dashboard-empty-illustration">
            <SketchDocument className="dashboard-empty-sketch" size={72} />
          </div>
          <h2 className="dashboard-empty-title display-heading">
            {t('trashEmptyTitle', { defaultValue: 'Trash is empty' })}
          </h2>
          <p className="dashboard-empty-desc">
            {t('trashEmptyDesc', { defaultValue: 'Deleted workspaces will appear here so you can easily restore them anytime.' })}
          </p>
        </motion.div>
      ) : filteredProjects.length === 0 ? (
        <motion.div className="dashboard-empty" variants={itemVariants}>
          <p className="dashboard-empty-desc">No trashed papers match "{searchQuery}"</p>
        </motion.div>
      ) : (
        <motion.div className="projects-grid" variants={gridVariants}>
          <AnimatePresence>
            {filteredProjects.map(project => {
              const tpl = getTemplate(project.templateId);
              return (
                <motion.div
                  key={project.id}
                  variants={cardVariants}
                  whileHover={hoverLift}
                  className="project-card"
                  style={{ opacity: 0.85 }}
                >
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
                    <div className="project-card-date" style={{ color: 'var(--error)' }}>
                      Deleted {formatDate(project.deletedAt)}
                    </div>
                  </div>
                  <div className="project-card-actions">
                    <motion.button
                      className="btn-secondary btn-sm"
                      onClick={() => restoreProject(project.id)}
                      whileTap={{ scale: 0.96 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <RotateCcw size={13} /> Restore
                    </motion.button>
                    <motion.button
                      className="btn-ghost btn-sm btn-danger-hover"
                      onClick={() => setConfirmPermanent(project.id)}
                      whileTap={{ scale: 0.9 }}
                      title="Delete Permanently"
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

      {/* Confirmation Modals */}
      <AnimatePresence>
        {/* Delete Single Permanently */}
        {confirmPermanent && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => setConfirmPermanent(null)}
          >
            <motion.div
              className="modal-panel"
              variants={modalVariants}
              style={{ maxWidth: 420 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title dashboard-section-title--icon">
                  <AlertTriangle size={16} style={{ color: 'var(--error)' }} /> Permanently Delete?
                </span>
                <button className="modal-close" onClick={() => setConfirmPermanent(null)}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  Are you sure you want to permanently delete this paper? This action cannot be undone.
                </p>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => setConfirmPermanent(null)}>{t('cancel')}</button>
                  <motion.button
                    className="btn-danger"
                    whileTap={{ scale: 0.96 }}
                    onClick={() => handlePermanentDelete(confirmPermanent)}
                  >
                    Delete Permanently
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Empty Trash Confirmation */}
        {showEmptyConfirm && (
          <motion.div
            className="modal-backdrop"
            variants={backdropVariants}
            initial="hidden"
            animate="show"
            exit="exit"
            onClick={() => setShowEmptyConfirm(false)}
          >
            <motion.div
              className="modal-panel"
              variants={modalVariants}
              style={{ maxWidth: 420 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title dashboard-section-title--icon">
                  <HelpCircle size={16} style={{ color: 'var(--error)' }} /> Empty Trash?
                </span>
                <button className="modal-close" onClick={() => setShowEmptyConfirm(false)}>
                  <X size={14} />
                </button>
              </div>
              <div className="modal-body">
                <p className="modal-desc">
                  This will permanently delete all ({trashedProjects.length}) items in your trash bin. This action cannot be undone.
                </p>
                <div className="modal-actions">
                  <button className="btn-ghost" onClick={() => setShowEmptyConfirm(false)}>{t('cancel')}</button>
                  <motion.button
                    className="btn-danger"
                    whileTap={{ scale: 0.96 }}
                    onClick={handleEmptyTrash}
                  >
                    Empty Trash
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
