import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { Star, Search, Trash2, Pin } from 'lucide-react';
import { getTemplate, getTemplateIcon, formatDate } from './dashboardUtils.jsx';
import { SketchDocument } from '@/components/SketchDecor/SketchDecor';
import {
  pageVariants,
  itemVariants,
  gridVariants,
  cardVariants,
  hoverLift,
} from '../dashboardMotion';

export default function StarredPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const projects = useAcaStore(s => s.projects);
  const openProject = useAcaStore(s => s.openProject);
  const trashProject = useAcaStore(s => s.trashProject);
  const togglePinProject = useAcaStore(s => s.togglePinProject);

  const [searchQuery, setSearchQuery] = useState('');

  // Filter only pinned, non-trashed projects
  const starredProjects = useMemo(() => {
    return projects.filter(p => (p.isPinned || p.pinned) && !p.deletedAt);
  }, [projects]);

  const filteredProjects = useMemo(() => {
    return starredProjects.filter(p => {
      const titleMatch = (p.metadata?.title || 'Untitled').toLowerCase().includes(searchQuery.toLowerCase());
      const authorMatch = (p.metadata?.authors || '').toLowerCase().includes(searchQuery.toLowerCase());
      const tplMatch = (getTemplate(p.templateId)?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
      return titleMatch || authorMatch || tplMatch;
    });
  }, [starredProjects, searchQuery]);

  const handleOpen = (id) => {
    openProject(id);
    navigate('/editor');
  };

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show">
      {/* Header with Search */}
      <motion.div className="project-toolbar" variants={itemVariants}>
        <div className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Star size={18} style={{ color: '#eab308', fill: '#eab308' }} />
          {t('starred', { defaultValue: 'Starred Papers' })} ({starredProjects.length})
        </div>
        {starredProjects.length > 0 && (
          <div className="search-container">
            <Search className="search-icon" size={14} />
            <input
              type="text"
              className="search-input"
              placeholder="Search starred papers..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        )}
      </motion.div>

      {/* Empty State */}
      {starredProjects.length === 0 ? (
        <motion.div className="dashboard-empty" variants={itemVariants}>
          <div className="dashboard-empty-illustration">
            <SketchDocument className="dashboard-empty-sketch" size={72} />
          </div>
          <h2 className="dashboard-empty-title display-heading">
            {t('noStarredTitle', { defaultValue: 'No starred papers yet' })}
          </h2>
          <p className="dashboard-empty-desc">
            {t('noStarredDesc', { defaultValue: 'Pin important research papers using the pin icon on your Dashboard cards for 1-click access here.' })}
          </p>
        </motion.div>
      ) : filteredProjects.length === 0 ? (
        <motion.div className="dashboard-empty" variants={itemVariants}>
          <p className="dashboard-empty-desc">No starred papers match "{searchQuery}"</p>
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
                  onClick={() => handleOpen(project.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <motion.button
                    type="button"
                    className="project-card-pin project-card-pin--active"
                    onClick={(e) => { e.stopPropagation(); togglePinProject(project.id); }}
                    whileTap={{ scale: 0.85 }}
                    title="Unstar paper"
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
                    <motion.button
                      className="btn-primary btn-sm"
                      onClick={(e) => { e.stopPropagation(); handleOpen(project.id); }}
                      whileTap={{ scale: 0.96 }}
                    >
                      {t('openWorkspace')}
                    </motion.button>
                    <motion.button
                      className="btn-ghost btn-sm btn-danger-hover project-card-delete"
                      onClick={(e) => { e.stopPropagation(); trashProject(project.id); }}
                      whileTap={{ scale: 0.9 }}
                      title="Move to Trash"
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
    </motion.div>
  );
}
