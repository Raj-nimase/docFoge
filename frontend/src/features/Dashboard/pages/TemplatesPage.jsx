import { useTranslation } from 'react-i18next';
import { useOutletContext } from 'react-router-dom';
import { TEMPLATES } from '@/utils/templates';
import { getTemplateIcon } from './dashboardUtils.jsx';

export default function TemplatesPage() {
  const { t } = useTranslation();
  const { onNewProject } = useOutletContext();

  return (
    <>
      <div className="dashboard-section-title">{t('preconfiguredLayouts')}</div>
      <div
        className="template-picker-grid"
        style={{ padding: 0 }}
      >
        {TEMPLATES.map(tpl => (
          <div
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
              {t('createProject')}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
