import { useTranslation } from 'react-i18next';

export default function ExportsPage() {
  const { t } = useTranslation();

  return (
    <>
      <div className="dashboard-section-title">{t('academicExportLogs')}</div>
      <div
        style={{ background: '#ffffff', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 20 }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.8rem' }}>
          <thead>
            <tr style={{ borderBottom: '1.5px solid var(--border)', paddingBottom: 8, color: 'var(--text-muted)' }}>
              <th style={{ padding: '8px 12px' }}>{t('documentHeader')}</th>
              <th>{t('fileTypeHeader')}</th>
              <th>{t('compileDurationHeader')}</th>
              <th>{t('exportDateHeader')}</th>
              <th style={{ textAlign: 'right', paddingRight: 12 }}>{t('actionHeader')}</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '12px' }}><b>{t('ieeeSizingTest', { defaultValue: 'IEEE Table Sizing Test' })}</b></td>
              <td>{t('latexPDF', { defaultValue: 'LaTeX PDF' })}</td>
              <td>{t('durationSeconds', { count: 4.2, defaultValue: '4.2 seconds' })}</td>
              <td>{t('todayTime', { defaultValue: 'Today, 02:40 PM' })}</td>
              <td style={{ textAlign: 'right', paddingRight: 12 }}><button className="btn-ghost btn-xs">{t('downloadBtn')}</button></td>
            </tr>
            <tr>
              <td style={{ padding: '12px' }}><b>{t('msbtePresentation', { defaultValue: 'MSBTE Presentation' })}</b></td>
              <td>{t('pdfDocument', { defaultValue: 'PDF Document' })}</td>
              <td>{t('durationSeconds', { count: 3.8, defaultValue: '3.8 seconds' })}</td>
              <td>{t('yesterdayTime', { defaultValue: 'Yesterday, 11:15 AM' })}</td>
              <td style={{ textAlign: 'right', paddingRight: 12 }}><button className="btn-ghost btn-xs">{t('downloadBtn')}</button></td>
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
