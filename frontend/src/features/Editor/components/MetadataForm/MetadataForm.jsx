import { useState } from 'react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { TEMPLATES } from '@/utils/templates';

export default function MetadataForm({ onDone }) {
  const updateMetadata = useAcaStore(s => s.updateMetadata);
  const currentProject = useAcaStore(s => s.getCurrentProject());
  const template = TEMPLATES.find(t => t.id === currentProject?.templateId);

  const [fields, setFields] = useState(currentProject?.metadata || {});
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    updateMetadata(fields);
    setOpen(false);
  };

  if (!open) {
    return (
      <button id="tour-doc-settings" type="button" className="sidebar-settings-btn" onClick={() => setOpen(true)} title="Document Settings">
        ⚙ Settings
      </button>
    );
  }

  return (
    <div className="metadata-overlay">
      <div className="metadata-panel" style={{ maxWidth: '840px', width: '90%' }}>
        <div className="metadata-header">
          <span className="metadata-title">⚙ Document Settings</span>
          <button className="metadata-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="metadata-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: '24px', maxHeight: '75vh', overflowY: 'auto' }}>
          {/* LEFT COLUMN: Document Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <h3 className="settings-section-title" style={{ marginTop: 0, marginBottom: '4px' }}>📋 Document Details</h3>
            {(template?.metadataFields || []).map(field => (
              <div key={field.key} className="metadata-field">
                <label className="metadata-label">
                  {field.label}
                  {field.required && <span className="metadata-required">*</span>}
                </label>
                {field.type === 'textarea' ? (
                  <textarea
                    className="metadata-input metadata-textarea"
                    value={fields[field.key] || ''}
                    onChange={e => setFields(f => ({ ...f, [field.key]: e.target.value }))}
                    rows={3}
                  />
                ) : (
                  <input
                    className="metadata-input"
                    type="text"
                    value={fields[field.key] || ''}
                    onChange={e => setFields(f => ({ ...f, [field.key]: e.target.value }))}
                  />
                )}
              </div>
            ))}
          </div>

          {/* RIGHT COLUMN: Document Layout & Header/Footers */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Document Layout Options */}
            <div>
              <h3 className="settings-section-title" style={{ marginTop: 0, marginBottom: '10px' }}>📄 Document Layout Options</h3>
              <div className="settings-subsection" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={fields.enableChapterNumbers !== false}
                    onChange={e => setFields(f => ({ ...f, enableChapterNumbers: e.target.checked }))}
                  />
                  Show Chapter Numbers (e.g. Chapter 1, 2)
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={fields.enableListOfFigures !== false}
                    onChange={e => setFields(f => ({ ...f, enableListOfFigures: e.target.checked }))}
                  />
                  Include List of Figures
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={fields.enableListOfTables !== false}
                    onChange={e => setFields(f => ({ ...f, enableListOfTables: e.target.checked }))}
                  />
                  Include List of Tables
                </label>
              </div>
            </div>

            <div className="settings-section-divider" style={{ margin: '4px 0' }} />

            {/* Custom Headers & Footers Settings */}
            <div>
              <h3 className="settings-section-title" style={{ marginTop: 0, marginBottom: '10px' }}>✨ Headers & Footers</h3>

              {/* Header Configuration */}
              <div className="settings-subsection" style={{ marginBottom: 12 }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!fields.enableHeader}
                    onChange={e => setFields(f => ({ ...f, enableHeader: e.target.checked }))}
                  />
                  Enable Custom Header
                </label>

                {!!fields.enableHeader && (
                  <div className="settings-subgrid" style={{ marginTop: 8 }}>
                    <div className="metadata-field">
                      <label className="metadata-label">Header Left</label>
                      <input
                        className="metadata-input"
                        type="text"
                        value={fields.headerLeft || ''}
                        placeholder="e.g. Left Info"
                        onChange={e => setFields(f => ({ ...f, headerLeft: e.target.value }))}
                      />
                    </div>
                    <div className="metadata-field">
                      <label className="metadata-label">Header Center</label>
                      <input
                        className="metadata-input"
                        type="text"
                        value={fields.headerCenter || ''}
                        placeholder="e.g. Center Title"
                        onChange={e => setFields(f => ({ ...f, headerCenter: e.target.value }))}
                      />
                    </div>
                    <div className="metadata-field">
                      <label className="metadata-label">Header Right</label>
                      <input
                        className="metadata-input"
                        type="text"
                        value={fields.headerRight || ''}
                        placeholder="e.g. Right Info"
                        onChange={e => setFields(f => ({ ...f, headerRight: e.target.value }))}
                      />
                    </div>
                    <label className="checkbox-label sub-checkbox" style={{ marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={fields.headerRule !== false}
                        onChange={e => setFields(f => ({ ...f, headerRule: e.target.checked }))}
                      />
                      Show Divider Line under Header
                    </label>
                  </div>
                )}
              </div>

              {/* Footer Configuration */}
              <div className="settings-subsection">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!fields.enableFooter}
                    onChange={e => setFields(f => ({ ...f, enableFooter: e.target.checked }))}
                  />
                  Enable Custom Footer
                </label>

                {!!fields.enableFooter && (
                  <div className="settings-subgrid" style={{ marginTop: 8 }}>
                    <div className="metadata-field">
                      <label className="metadata-label">Footer Left</label>
                      <input
                        className="metadata-input"
                        type="text"
                        value={fields.footerLeft || ''}
                        placeholder="e.g. Footer Left"
                        onChange={e => setFields(f => ({ ...f, footerLeft: e.target.value }))}
                      />
                    </div>
                    <div className="metadata-field">
                      <label className="metadata-label">Footer Center</label>
                      <input
                        className="metadata-input"
                        type="text"
                        value={fields.footerCenter || ''}
                        placeholder="e.g. Page [Page]"
                        onChange={e => setFields(f => ({ ...f, footerCenter: e.target.value }))}
                      />
                    </div>
                    <div className="metadata-field">
                      <label className="metadata-label">Footer Right</label>
                      <input
                        className="metadata-input"
                        type="text"
                        value={fields.footerRight || ''}
                        placeholder="e.g. Footer Right"
                        onChange={e => setFields(f => ({ ...f, footerRight: e.target.value }))}
                      />
                    </div>
                    <label className="checkbox-label sub-checkbox" style={{ marginTop: 6 }}>
                      <input
                        type="checkbox"
                        checked={!!fields.footerRule}
                        onChange={e => setFields(f => ({ ...f, footerRule: e.target.checked }))}
                      />
                      Show Divider Line above Footer
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="metadata-footer">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
