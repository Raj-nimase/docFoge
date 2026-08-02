import { useTranslation } from 'react-i18next';
import { motion } from 'motion/react';
import { FileText, Download } from 'lucide-react';
import { SketchDocument } from '@/components/SketchDecor/SketchDecor';
import { pageVariants, itemVariants, gridVariants, cardVariants } from '../dashboardMotion';

export default function ExportsPage() {
  const { t } = useTranslation();

  // Demo data until real export history is tracked in the store
  const demoExports = [
    {
      id: 'ieee-sizing-test',
      name: t('ieeeSizingTest', { defaultValue: 'IEEE Table Sizing Test' }),
      type: t('latexPDF', { defaultValue: 'LaTeX PDF' }),
      duration: t('durationSeconds', { count: 4.2, defaultValue: '4.2 seconds' }),
      date: t('todayTime', { defaultValue: 'Today, 02:40 PM' }),
    },
    {
      id: 'msbte-presentation',
      name: t('msbtePresentation', { defaultValue: 'MSBTE Presentation' }),
      type: t('pdfDocument', { defaultValue: 'PDF Document' }),
      duration: t('durationSeconds', { count: 3.8, defaultValue: '3.8 seconds' }),
      date: t('yesterdayTime', { defaultValue: 'Yesterday, 11:15 AM' }),
    },
  ];

  return (
    <motion.div variants={pageVariants} initial="hidden" animate="show">
      <motion.div className="dashboard-section-title" variants={itemVariants}>
        {t('academicExportLogs')}
      </motion.div>

      {demoExports.length === 0 ? (
        <motion.div className="dashboard-empty" variants={itemVariants}>
          <div className="dashboard-empty-illustration">
            <SketchDocument className="dashboard-empty-sketch" size={72} />
          </div>
          <h2 className="dashboard-empty-title display-heading">
            {t('noExportsYet', { defaultValue: 'No exports yet' })}
          </h2>
          <p className="dashboard-empty-desc">
            {t('noExportsHint', { defaultValue: 'Compile a project to PDF and your export history will appear here.' })}
          </p>
        </motion.div>
      ) : (
        <motion.div className="exports-card" variants={itemVariants}>
          <table className="exports-table">
            <thead>
              <tr>
                <th>{t('documentHeader')}</th>
                <th>{t('fileTypeHeader')}</th>
                <th className="col-duration">{t('compileDurationHeader')}</th>
                <th>{t('exportDateHeader')}</th>
                <th style={{ textAlign: 'right' }}>{t('actionHeader')}</th>
              </tr>
            </thead>
            <motion.tbody variants={gridVariants} initial="hidden" animate="show">
              {demoExports.map(row => (
                /* opacity-only variants would be the fallback if y-transforms
                   ever glitch on <tr>; works fine in modern engines */
                <motion.tr key={row.id} variants={cardVariants}>
                  <td>
                    <span className="exports-doc">
                      <span className="exports-doc-icon">
                        <FileText size={15} />
                      </span>
                      {row.name}
                    </span>
                  </td>
                  <td>
                    <span className="exports-badge">{row.type}</span>
                  </td>
                  <td className="col-duration">
                    <span className="exports-duration">{row.duration}</span>
                  </td>
                  <td>{row.date}</td>
                  <td style={{ textAlign: 'right' }}>
                    <motion.button className="exports-download" whileTap={{ scale: 0.95 }}>
                      <Download size={13} /> {t('downloadBtn')}
                    </motion.button>
                  </td>
                </motion.tr>
              ))}
            </motion.tbody>
          </table>
        </motion.div>
      )}
    </motion.div>
  );
}
