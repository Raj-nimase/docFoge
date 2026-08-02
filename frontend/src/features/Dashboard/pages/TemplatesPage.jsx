import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'motion/react';
import { TEMPLATES } from '@/utils/templates';
import { getTemplateIcon } from './dashboardUtils.jsx';
import { SketchCircle } from '@/components/SketchDecor/SketchDecor';
import { pageVariants, itemVariants, gridVariants, cardVariants, hoverLift } from '../dashboardMotion';

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { onNewProject } = useOutletContext();

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show">
      <motion.div className="dashboard-section-title" variants={itemVariants}>
        {t('preconfiguredLayouts')}
      </motion.div>
      <motion.div className="tpl-grid" variants={gridVariants}>
        {TEMPLATES.map(tpl => (
          <motion.div
            key={tpl.id}
            className="tpl-card"
            variants={cardVariants}
            whileHover={hoverLift}
          >
            <span className="tpl-card-icon">
              <SketchCircle className="tpl-card-sketch" />
              {getTemplateIcon(tpl.icon)}
            </span>
            <h3 className="tpl-card-name">{tpl.name}</h3>
            <p className="tpl-card-desc">{tpl.description}</p>
            <motion.button
              className="btn-primary btn-sm"
              onClick={onNewProject}
              whileTap={{ scale: 0.96 }}
            >
              {t('createProject')}
            </motion.button>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
}
