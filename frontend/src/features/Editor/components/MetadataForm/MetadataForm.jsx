import { useState } from 'react';
import { Settings, X, FileText, LayoutGrid, PanelTop, Ruler } from 'lucide-react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { TEMPLATES } from '@/utils/templates';

export default function MetadataForm({ onDone }) {
  const updateMetadata = useAcaStore(s => s.updateMetadata);
  const currentProject = useAcaStore(s => s.getCurrentProject());
  const template = TEMPLATES.find(t => t.id === currentProject?.templateId);

  const [fields, setFields] = useState(() => {
    const meta = currentProject?.metadata || {};
    return {
      ...meta,
      headerRule: meta.headerRule !== undefined ? meta.headerRule : true,
      footerRule: meta.footerRule !== undefined ? meta.footerRule : true
    };
  });
  const [open, setOpen] = useState(false);

  const handleSave = () => {
    updateMetadata(fields);
    setOpen(false);
  };

  if (!open) {
    return (
      <button id="tour-doc-settings" type="button" className="ribbon-action-btn ribbon-action-btn--primary" onClick={() => setOpen(true)} title="Document Settings">
        <Settings size={15} /><span className="ribbon-action-label">Settings</span>
      </button>
    );
  }

  return (
    <div className="metadata-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="metadata-panel metadata-panel--wide">
        <div className="metadata-header">
          <span className="metadata-title">
            <span className="metadata-title-icon"><Settings size={16} /></span>
            Document Settings
          </span>
          <button className="metadata-close" onClick={() => setOpen(false)} title="Close">
            <X size={16} />
          </button>
        </div>
        <div className="metadata-body metadata-body--grid">
          {/* LEFT COLUMN: Document Details + Page Setup & Margins */}
          <div className="settings-column">
            {/* Document Details */}
            <div className="settings-card">
              <h3 className="settings-section-title">
                <FileText size={14} /> Document Details
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                        rows={2}
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
            </div>

            {/* Page Setup & Margins */}
            <div className="settings-card">
              <h3 className="settings-section-title">
                <Ruler size={14} /> Page Setup & Margins
              </h3>
              <div className="settings-subsection" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                
                {/* Page Size & Base Font Size */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                  <div className="metadata-field">
                    <label className="metadata-label">Page Size</label>
                    <select
                      className="metadata-input"
                      value={fields.pageSize || 'a4paper'}
                      onChange={e => setFields(f => ({ ...f, pageSize: e.target.value }))}
                    >
                      <option value="a4paper">A4 (210 × 297 mm)</option>
                      <option value="letterpaper">Letter (8.5 × 11 in)</option>
                      <option value="legalpaper">Legal (8.5 × 14 in)</option>
                      <option value="a5paper">A5 (148 × 210 mm)</option>
                      <option value="executivepaper">Executive</option>
                    </select>
                  </div>

                  <div className="metadata-field">
                    <label className="metadata-label">Base Font Size</label>
                    <select
                      className="metadata-input"
                      value={fields.fontSize || '12pt'}
                      onChange={e => setFields(f => ({ ...f, fontSize: e.target.value }))}
                    >
                      <option value="12pt">12 pt (Standard Default)</option>
                      <option value="11pt">11 pt</option>
                      <option value="10pt">10 pt</option>
                      <option value="9pt">9 pt (Compact)</option>
                      <option value="8pt">8 pt (Micro)</option>
                      <option value="14pt">14 pt (Large)</option>
                      <option value="16pt">16 pt (Extra Large)</option>
                      <option value="18pt">18 pt</option>
                      <option value="20pt">20 pt</option>
                    </select>
                  </div>
                </div>

                {/* Line Spacing */}
                <div className="metadata-field">
                  <label className="metadata-label">Line Spacing</label>
                  <select
                    className="metadata-input"
                    value={fields.lineSpacing || '1.5'}
                    onChange={e => setFields(f => ({ ...f, lineSpacing: e.target.value }))}
                  >
                    <option value="1.5">1.5x Spacing (Standard Default)</option>
                    <option value="1.0">1.0x Single Spacing</option>
                    <option value="1.15">1.15x Compact Spacing</option>
                    <option value="2.0">2.0x Double Spacing</option>
                  </select>
                </div>

                {/* Margins Preset */}
                <div className="metadata-field">
                  <label className="metadata-label">Margins</label>
                  <select
                    className="metadata-input"
                    value={fields.marginPreset || 'default'}
                    onChange={e => {
                      const val = e.target.value;
                      if (val === 'default') {
                        setFields(f => ({ ...f, marginPreset: val, marginTop: '2.5cm', marginBottom: '2.5cm', marginLeft: '3.5cm', marginRight: '1.25cm' }));
                      } else if (val === 'normal') {
                        setFields(f => ({ ...f, marginPreset: val, marginTop: '2.54cm', marginBottom: '2.54cm', marginLeft: '2.54cm', marginRight: '2.54cm' }));
                      } else if (val === 'narrow') {
                        setFields(f => ({ ...f, marginPreset: val, marginTop: '1.27cm', marginBottom: '1.27cm', marginLeft: '1.27cm', marginRight: '1.27cm' }));
                      } else if (val === 'wide') {
                        setFields(f => ({ ...f, marginPreset: val, marginTop: '2.54cm', marginBottom: '2.54cm', marginLeft: '3.81cm', marginRight: '3.81cm' }));
                      } else {
                        setFields(f => ({ ...f, marginPreset: 'custom' }));
                      }
                    }}
                  >
                    <option value="default">Default Academic (Top: 2.5cm, Bottom: 2.5cm, Left: 3.5cm, Right: 1.25cm)</option>
                    <option value="normal">Normal (1 in / 2.54 cm all sides)</option>
                    <option value="narrow">Narrow (0.5 in / 1.27 cm all sides)</option>
                    <option value="wide">Wide (1 in Top/Bottom, 1.5 in Left/Right)</option>
                    <option value="custom">Custom Margins...</option>
                  </select>
                </div>

                {/* Custom Margin Inputs */}
                {fields.marginPreset === 'custom' && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, marginTop: 4, background: 'var(--bg)', padding: 10, borderRadius: 'var(--radius-md)' }}>
                    <div className="metadata-field">
                      <label className="metadata-label">Top Margin</label>
                      <input
                        className="metadata-input"
                        type="text"
                        placeholder="2.5cm"
                        value={fields.marginTop || '2.5cm'}
                        onChange={e => setFields(f => ({ ...f, marginTop: e.target.value }))}
                      />
                    </div>
                    <div className="metadata-field">
                      <label className="metadata-label">Bottom Margin</label>
                      <input
                        className="metadata-input"
                        type="text"
                        placeholder="2.5cm"
                        value={fields.marginBottom || '2.5cm'}
                        onChange={e => setFields(f => ({ ...f, marginBottom: e.target.value }))}
                      />
                    </div>
                    <div className="metadata-field">
                      <label className="metadata-label">Left Margin</label>
                      <input
                        className="metadata-input"
                        type="text"
                        placeholder="3.5cm"
                        value={fields.marginLeft || '3.5cm'}
                        onChange={e => setFields(f => ({ ...f, marginLeft: e.target.value }))}
                      />
                    </div>
                    <div className="metadata-field">
                      <label className="metadata-label">Right Margin</label>
                      <input
                        className="metadata-input"
                        type="text"
                        placeholder="1.25cm"
                        value={fields.marginRight || '1.25cm'}
                        onChange={e => setFields(f => ({ ...f, marginRight: e.target.value }))}
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* RIGHT COLUMN: Document Layout Options + Headers & Footers */}
          <div className="settings-column">
            {/* Document Layout Options */}
            <div className="settings-card">
              <h3 className="settings-section-title">
                <LayoutGrid size={14} /> Document Layout Options
              </h3>
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

            {/* Custom Headers & Footers Settings */}
            <div className="settings-card">
              <h3 className="settings-section-title">
                <PanelTop size={14} /> Headers & Footers
              </h3>

              {/* Header Configuration */}
              <div className="settings-subsection" style={{ marginBottom: 14 }}>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={!!fields.enableHeader}
                    onChange={e => {
                      const checked = e.target.checked;
                      setFields(f => ({
                        ...f,
                        enableHeader: checked,
                        headerRule: checked ? true : f.headerRule
                      }));
                    }}
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
                    onChange={e => {
                      const checked = e.target.checked;
                      setFields(f => ({
                        ...f,
                        enableFooter: checked,
                        footerRule: checked ? true : f.footerRule
                      }));
                    }}
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
                        checked={fields.footerRule !== false}
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
