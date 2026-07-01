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
      <div className="metadata-panel">
        <div className="metadata-header">
          <span className="metadata-title">⚙ Document Settings</span>
          <button className="metadata-close" onClick={() => setOpen(false)}>✕</button>
        </div>
        <div className="metadata-body">
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

          {/* Custom Headers & Footers Settings */}
          <div className="settings-section-divider" />
          <h3 className="settings-section-title">✨ Headers & Footers</h3>

          {/* Header Configuration */}
          <div className="settings-subsection">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={!!fields.enableHeader}
                onChange={e => setFields(f => ({ ...f, enableHeader: e.target.checked }))}
              />
              Enable Custom Header
            </label>

            {!!fields.enableHeader && (
              <div className="settings-subgrid">
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
                <label className="checkbox-label sub-checkbox">
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
              <div className="settings-subgrid">
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
                <label className="checkbox-label sub-checkbox">
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
        <div className="metadata-footer">
          <button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Settings</button>
        </div>
      </div>
    </div>
  );
}
