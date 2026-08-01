import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { TEMPLATES } from '@/utils/templates';
import useAcaStore from '@/contexts/projectStore/projectStore';
import useAuthStore from '@/contexts/authStore/authStore';
import {
  Search,
  Eye,
  Check,
  UploadCloud,
  Sparkles,
  Lightbulb,
  X,
  GraduationCap,
  FileText,
  BookOpen,
  FileCode,
  Files,
  CheckCircle,
  HelpCircle,
  ArrowRight,
  ArrowLeft,
  Settings,
  ClipboardList,
  Info
} from 'lucide-react';

function getTemplateIcon(iconStr, className = "") {
  const iconStyle = { color: 'var(--accent)' };
  switch (iconStr) {
    case '🎓':
      return <GraduationCap className={className} size={24} strokeWidth={1.8} style={iconStyle} />;
    case '📄':
      return <FileText className={className} size={24} strokeWidth={1.8} style={iconStyle} />;
    case '📚':
      return <BookOpen className={className} size={24} strokeWidth={1.8} style={iconStyle} />;
    case '📝':
      return <FileCode className={className} size={24} strokeWidth={1.8} style={iconStyle} />;
    case '📃':
      return <Files className={className} size={24} strokeWidth={1.8} style={iconStyle} />;
    default:
      return <FileText className={className} size={24} strokeWidth={1.8} style={iconStyle} />;
  }
}

export default function NewProject({ onCreated, onCancel }) {
  const { t } = useTranslation();
  const createProject = useAcaStore(s => s.createProject);
  const user = useAuthStore(s => s.user);

  // Stepper state: 1 to 4 (Details → Page Setup → Template → Assemble)
  const [step, setStep]           = useState(1);
  const [direction, setDirection] = useState(1); // 1 = next, -1 = back

  const goToStep = (nextStep) => {
    setDirection(nextStep > step ? 1 : -1);
    setStep(nextStep);
  };

  // STEP 1: Project Details
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory]       = useState('Academic');
  const [tags, setTags]               = useState('research, latex');

  // STEP 3: Template Selection
  const [selectedId, setSelectedId]   = useState('ieee-paper'); // Default template
  const [tplCategory, setTplCategory] = useState('All');
  const [tplSearch, setTplSearch]     = useState('');
  const [previewModalTpl, setPreviewModalTpl] = useState(null);

  // STEP 4: Preview & Compilation
  const [draftContent, setDraftContent] = useState('');
  const [compilingLogs, setCompilingLogs] = useState([]);
  const [compileProgress, setCompileProgress] = useState(0);
  const [hasLaunched, setHasLaunched] = useState(false);

  // Template metadata details fields mapper
  const [metadata, setMetadata] = useState({
    title: '',
    authors: user?.name || '',
    guide: '',
    department: user?.department || '',
    institution: user?.institution || '',
    year: new Date().getFullYear().toString(),
    pageSize: 'a4paper',
    fontSize: '12pt',
    lineSpacing: '1.5',
    marginPreset: 'default',
    marginTop: '2.5cm',
    marginBottom: '2.5cm',
    marginLeft: '3.5cm',
    marginRight: '1.25cm',
    enableChapterNumbers: true,
    enableListOfFigures: true,
    enableListOfTables: true,
  });

  const selectedTpl = TEMPLATES.find(t => t.id === selectedId) || TEMPLATES[1];

  // Sync title from step 1 to template metadata title
  useEffect(() => {
    setMetadata(prev => ({ ...prev, title }));
  }, [title]);

  // Prefill author/institution from signed-in user
  useEffect(() => {
    if (!user) return;
    setMetadata(prev => ({
      ...prev,
      authors: prev.authors || user.name || '',
      institution: prev.institution || user.institution || '',
      department: prev.department || user.department || '',
    }));
  }, [user]);

  // Filter templates list based on search/category
  const filteredTemplates = TEMPLATES.filter(t => {
    const searchMatch = t.name.toLowerCase().includes(tplSearch.toLowerCase()) ||
                        t.description.toLowerCase().includes(tplSearch.toLowerCase());
    
    if (tplCategory === 'All') return searchMatch;
    if (tplCategory === 'Academic') return searchMatch && (t.id === 'ieee-paper' || t.id === 'thesis');
    if (tplCategory === 'Reports') return searchMatch && t.id === 'diploma-project-report';
    if (tplCategory === 'General') return searchMatch && (t.id === 'assignment' || t.id === 'blank');
    return searchMatch;
  });

  // Submit and open active project
  const handleCreate = () => {
    if (!selectedId) return;

    // Call state creator
    createProject(selectedId, {
      ...metadata,
      title: title || metadata.title,
      description,
      category,
      tags,
      draftContent
    });

    onCreated();
  };

  // Step 4 simulated compilation logging
  useEffect(() => {
    if (step !== 4) return;

    setCompilingLogs([]);
    setCompileProgress(0);

    const logMessages = [
      { time: '12:04:01', msg: '📝 Preparing workspace drafts and file pipelines...', success: false },
      { time: '12:04:02', msg: `📦 Assembling chapters directory based on: ${selectedTpl.name}`, success: false },
      { time: '12:04:03', msg: `📂 Hydrating metadata values for authors: "${metadata.authors}"`, success: false },
      { time: '12:04:05', msg: '✨ Applying custom page geometry, margins & citation standards...', success: false },
      { time: '12:04:06', msg: `🛡️ Injecting LaTeX packages & standard styles...`, success: false },
      { time: '12:04:07', msg: '✅ LaTeX document workspace compiled successfully!', success: true }
    ];

    let currentLogIndex = 0;
    const logInterval = setInterval(() => {
      if (currentLogIndex < logMessages.length) {
        const nextLog = logMessages[currentLogIndex];
        setCompilingLogs(prev => [...prev, nextLog]);
        setCompileProgress(prev => Math.min(prev + 20, 100));
        currentLogIndex++;
      } else {
        clearInterval(logInterval);
        setCompileProgress(100);
      }
    }, 700);

    return () => clearInterval(logInterval);
  }, [step, selectedTpl.name, metadata.authors]);

  // Auto-launch workspace when compilation finishes
  useEffect(() => {
    if (step === 4 && compileProgress === 100 && !hasLaunched) {
      setHasLaunched(true);
      handleCreate();
    }
  }, [compileProgress, step, hasLaunched, handleCreate]);

  // Pre-fill content using AI panel simulation
  const handleAiAction = (action) => {
    if (action.includes("Abstract")) {
      setDraftContent("ABSTRACT\n\nThis research paper explores the optimization of real-time PDF generation pipeline. By utilizing Google Gemini formatting services in synergy with a tectonic LaTeX backend compiler engine, we introduce a professional system that eliminates typography errors, ensures IEEE margin layouts, and guarantees publication-ready structures instantly.");
    } else if (action.includes("Formal")) {
      setDraftContent(prev => prev ? prev + "\n\nFurthermore, experimental evaluations demonstrate that the compiler latency completes in less than five seconds, providing high-fidelity visual preview rendering." : "In this article, we propose a mathematical model to optimize spacing variables inside academic preambles.");
    } else {
      setDraftContent(prev => prev ? prev + "\n\n1. Introduction\n2. Literature Review\n3. Methodology\n4. Experimental Setup\n5. Bibliographical Citations" : "1. Introduction\n2. Background\n3. Proposed Model\n4. Conclusion");
    }
  };

  return (
    <div className="new-project-page">
      <div className="wizard-card">
        
        {/* WIZARD STEPPER TRACKER */}
        <header className="wizard-stepper">
          <div className={`stepper-node ${step === 1 ? 'stepper-node--active' : ''} ${step > 1 ? 'stepper-node--completed' : ''}`} onClick={() => step > 1 && goToStep(1)} style={{ cursor: step > 1 ? 'pointer' : 'default' }}>
            <span className="stepper-circle">{step > 1 ? <Check size={12} /> : "1"}</span>
            <span className="stepper-label">{t('wizardDetails')}</span>
          </div>
          <span className={`stepper-line ${step > 1 ? 'stepper-line--active' : ''}`} />

          <div className={`stepper-node ${step === 2 ? 'stepper-node--active' : ''} ${step > 2 ? 'stepper-node--completed' : ''}`} onClick={() => step > 2 && goToStep(2)} style={{ cursor: step > 2 ? 'pointer' : 'default' }}>
            <span className="stepper-circle">{step > 2 ? <Check size={12} /> : "2"}</span>
            <span className="stepper-label">Page Setup</span>
          </div>
          <span className={`stepper-line ${step > 2 ? 'stepper-line--active' : ''}`} />

          <div className={`stepper-node ${step === 3 ? 'stepper-node--active' : ''} ${step > 3 ? 'stepper-node--completed' : ''}`} onClick={() => step > 3 && goToStep(3)} style={{ cursor: step > 3 ? 'pointer' : 'default' }}>
            <span className="stepper-circle">{step > 3 ? <Check size={12} /> : "3"}</span>
            <span className="stepper-label">{t('wizardTemplate')}</span>
          </div>
          <span className={`stepper-line ${step > 3 ? 'stepper-line--active' : ''}`} />

          <div className={`stepper-node ${step === 4 ? 'stepper-node--active' : ''}`}>
            <span className="stepper-circle">4</span>
            <span className="stepper-label">{t('wizardAssemble')}</span>
          </div>
        </header>

        {/* ACTIVE WIZARD SCREEN */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
          <>
            <main
              key={step}
              className="wizard-body"
            >
              
              {/* STEP 1: PROJECT DETAILS */}
              {step === 1 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600, margin: '0 auto', width: '100%' }}>
                  <div className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Info size={18} style={{ color: 'var(--accent)' }} /> {t('step1Title')}
                  </div>
                  
                  <div className="floating-field">
                    <label className="metadata-label">{t('workspaceTitleLabel')}</label>
                    <input
                      type="text"
                      className="floating-input"
                      placeholder={t('workspaceTitlePlaceholder')}
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                    />
                  </div>

                  <div className="floating-field">
                    <label className="metadata-label">{t('draftAbstractLabel')}</label>
                    <textarea
                      className="floating-input"
                      style={{ resize: 'none', height: 80 }}
                      placeholder={t('draftAbstractPlaceholder')}
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <div className="metadata-field">
                      <label className="metadata-label">{t('academicCategory')}</label>
                      <select className="metadata-input" value={category} onChange={e => setCategory(e.target.value)}>
                        <option>{t('academic', { defaultValue: 'Academic' })}</option>
                        <option>{t('businessReport', { defaultValue: 'Business Report' })}</option>
                        <option>{t('technicalPaper', { defaultValue: 'Technical Paper' })}</option>
                        <option>{t('thesisOutline', { defaultValue: 'Thesis Outline' })}</option>
                      </select>
                    </div>

                    <div className="floating-field">
                      <label className="metadata-label">{t('keywordsTags')}</label>
                      <input
                        type="text"
                        className="floating-input"
                        placeholder={t('keywordsPlaceholder')}
                        value={tags}
                        onChange={e => setTags(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Specific metadata fields preview */}
                  <div style={{ background: 'var(--bg)', borderRadius: 'var(--radius-lg)', padding: 16, marginTop: 12 }}>
                    <span className="metadata-label" style={{ marginBottom: 8, display: 'block' }}>{t('authorsGuideDetails')}</span>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <input
                        type="text"
                        className="metadata-input"
                        placeholder={t('authorPlaceholder')}
                        value={metadata.authors}
                        onChange={e => setMetadata({ ...metadata, authors: e.target.value })}
                      />
                      <input
                        type="text"
                        className="metadata-input"
                        placeholder={t('guidePlaceholder')}
                        value={metadata.guide}
                        onChange={e => setMetadata({ ...metadata, guide: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 2: PAGE SETUP & LAYOUT (DEDICATED STEP) */}
              {step === 2 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20, width: '100%', maxWidth: 620, margin: '0 auto' }}>
                  <div>
                    <div className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <Settings size={18} style={{ color: 'var(--accent)' }} /> Page Setup & Layout
                    </div>
                    <p style={{ fontSize: '0.84rem', color: 'var(--text-muted)', margin: 0 }}>
                      Customize page geometry, margins, line spacing, and document options. Defaults will be used if left unchanged.
                    </p>
                  </div>

                  {/* 2-Column Form: Typography vs Margins */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
                    
                    {/* LEFT COLUMN: Page & Typography */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="metadata-field">
                        <label className="metadata-label">Page Size</label>
                        <select
                          className="metadata-input"
                          value={metadata.pageSize || 'a4paper'}
                          onChange={e => setMetadata({ ...metadata, pageSize: e.target.value })}
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
                          value={metadata.fontSize || '12pt'}
                          onChange={e => setMetadata({ ...metadata, fontSize: e.target.value })}
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

                      <div className="metadata-field">
                        <label className="metadata-label">Line Spacing</label>
                        <select
                          className="metadata-input"
                          value={metadata.lineSpacing || '1.5'}
                          onChange={e => setMetadata({ ...metadata, lineSpacing: e.target.value })}
                        >
                          <option value="1.5">1.5x (Standard Default)</option>
                          <option value="1.0">1.0x (Single Spacing)</option>
                          <option value="1.15">1.15x (Compact)</option>
                          <option value="2.0">2.0x (Double Spacing)</option>
                        </select>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Margins */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div className="metadata-field">
                        <label className="metadata-label">Margins Preset</label>
                        <select
                          className="metadata-input"
                          value={metadata.marginPreset || 'default'}
                          onChange={e => {
                            const val = e.target.value;
                            if (val === 'default') {
                              setMetadata({ ...metadata, marginPreset: val, marginTop: '2.5cm', marginBottom: '2.5cm', marginLeft: '3.5cm', marginRight: '1.25cm' });
                            } else if (val === 'normal') {
                              setMetadata({ ...metadata, marginPreset: val, marginTop: '2.54cm', marginBottom: '2.54cm', marginLeft: '2.54cm', marginRight: '2.54cm' });
                            } else if (val === 'narrow') {
                              setMetadata({ ...metadata, marginPreset: val, marginTop: '1.27cm', marginBottom: '1.27cm', marginLeft: '1.27cm', marginRight: '1.27cm' });
                            } else if (val === 'wide') {
                              setMetadata({ ...metadata, marginPreset: val, marginTop: '2.54cm', marginBottom: '2.54cm', marginLeft: '3.81cm', marginRight: '3.81cm' });
                            } else {
                              setMetadata({ ...metadata, marginPreset: 'custom' });
                            }
                          }}
                        >
                          <option value="default">Default Margins (Academic)</option>
                          <option value="normal">Normal (1 in / 2.54 cm)</option>
                          <option value="narrow">Narrow (0.5 in / 1.27 cm)</option>
                          <option value="wide">Wide (1.5 in Side Margins)</option>
                          <option value="custom">Custom Margins...</option>
                        </select>
                      </div>

                      {/* Custom Margins: 2x2 grid */}
                      {metadata.marginPreset === 'custom' ? (
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, background: 'var(--bg)', padding: 12, borderRadius: 'var(--radius-md)' }}>
                          <div>
                            <label className="metadata-label" style={{ fontSize: '0.7rem' }}>Top</label>
                            <input
                              type="text"
                              className="metadata-input"
                              value={metadata.marginTop || '2.5cm'}
                              onChange={e => setMetadata({ ...metadata, marginTop: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="metadata-label" style={{ fontSize: '0.7rem' }}>Bottom</label>
                            <input
                              type="text"
                              className="metadata-input"
                              value={metadata.marginBottom || '2.5cm'}
                              onChange={e => setMetadata({ ...metadata, marginBottom: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="metadata-label" style={{ fontSize: '0.7rem' }}>Left</label>
                            <input
                              type="text"
                              className="metadata-input"
                              value={metadata.marginLeft || '3.5cm'}
                              onChange={e => setMetadata({ ...metadata, marginLeft: e.target.value })}
                            />
                          </div>
                          <div>
                            <label className="metadata-label" style={{ fontSize: '0.7rem' }}>Right</label>
                            <input
                              type="text"
                              className="metadata-input"
                              value={metadata.marginRight || '1.25cm'}
                              onChange={e => setMetadata({ ...metadata, marginRight: e.target.value })}
                            />
                          </div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', background: 'var(--bg)', padding: '10px 12px', borderRadius: 'var(--radius-md)', lineHeight: '1.4' }}>
                          <strong>Current Margins:</strong><br />
                          Top: {metadata.marginTop || '2.5cm'} • Bottom: {metadata.marginBottom || '2.5cm'}<br />
                          Left: {metadata.marginLeft || '3.5cm'} • Right: {metadata.marginRight || '1.25cm'}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Horizontal Checkboxes Row */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                    <span className="metadata-label" style={{ fontWeight: 600 }}>Document Layout Options</span>
                    <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                      <label className="checkbox-label" style={{ fontSize: '0.82rem' }}>
                        <input
                          type="checkbox"
                          checked={metadata.enableChapterNumbers !== false}
                          onChange={e => setMetadata({ ...metadata, enableChapterNumbers: e.target.checked })}
                        />
                        Show Chapter Numbers
                      </label>
                      <label className="checkbox-label" style={{ fontSize: '0.82rem' }}>
                        <input
                          type="checkbox"
                          checked={metadata.enableListOfFigures !== false}
                          onChange={e => setMetadata({ ...metadata, enableListOfFigures: e.target.checked })}
                        />
                        List of Figures
                      </label>
                      <label className="checkbox-label" style={{ fontSize: '0.82rem' }}>
                        <input
                          type="checkbox"
                          checked={metadata.enableListOfTables !== false}
                          onChange={e => setMetadata({ ...metadata, enableListOfTables: e.target.checked })}
                        />
                        List of Tables
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 3: TEMPLATE SELECTOR */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                  <div className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ClipboardList size={18} style={{ color: 'var(--accent)' }} /> {t('step2Title')}
                  </div>

                  <div className="tpl-search-row">
                    <div className="search-container" style={{ width: 280 }}>
                      <Search className="search-icon" size={14} />
                      <input
                        type="text"
                        className="search-input"
                        placeholder={t('findStylesPlaceholder')}
                        value={tplSearch}
                        onChange={e => setTplSearch(e.target.value)}
                      />
                    </div>

                    <div className="tpl-cats">
                      {['All', 'Academic', 'Reports', 'General'].map(cat => (
                        <button
                          key={cat}
                          className={`tpl-cat-btn ${tplCategory === cat ? 'tpl-cat-btn--active' : ''}`}
                          onClick={() => setTplCategory(cat)}
                        >
                          {t(cat, { defaultValue: cat })}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Templates Selection Grid */}
                  <div className="template-picker-grid" style={{ padding: 0, overflowY: 'auto', flex: 1 }}>
                    {filteredTemplates.map(tpl => (
                      <div
                        key={tpl.id}
                        className={`template-card ${selectedId === tpl.id ? 'template-card--selected' : ''}`}
                        onClick={() => setSelectedId(tpl.id)}
                      >
                        <span className="template-card-icon">{getTemplateIcon(tpl.icon)}</span>
                        <div className="template-card-name" style={{ marginTop: 8 }}>{tpl.name}</div>
                        <div className="template-card-desc">{tpl.description}</div>
                        
                        {/* Visual details outline trigger */}
                        <button
                          className="btn-ghost btn-xs"
                          style={{ marginTop: 10, alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: 4 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewModalTpl(tpl);
                          }}
                        >
                          <Eye size={12} /> {t('layoutStructure')}
                        </button>

                        {selectedId === tpl.id && (
                          <span className="template-card-check" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Check size={12} strokeWidth={3} />
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 4: PREVIEW & ASSEMBLY */}
              {step === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, margin: '0 auto', width: '100%', textAlign: 'center' }}>
                  <div className="dashboard-section-title">{t('step3Title')}</div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '20px 0' }}>
                    <div className="preview-compile-spinner" style={{ width: 44, height: 44 }} />
                    <span style={{ fontWeight: 700, fontSize: '1rem', marginTop: 16 }}>{t('compilingPreamble')}</span>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{t('estimatedTimeRemaining')}</span>
                  </div>

                  {/* Logger Console logs */}
                  <div className="logger-console">
                    <>
                      {compilingLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className="logger-row"
                        >
                          <span className="logger-time">[{log.time}]</span>
                          <span className={log.success ? 'logger-msg--success' : 'logger-msg'}>{log.msg}</span>
                        </div>
                      ))}
                    </>
                  </div>

                  {/* Progress bar */}
                  <div className="progress-track-wizard">
                    <div
                      className="progress-bar-wizard"
                      style={{ width: `${compileProgress}%` }}
                    />
                  </div>
                </div>
              )}

            </main>
          </>
        </div>

        {/* WIZARD ACTIONS FOOTER */}
        <footer className="new-project-footer">
          {step > 1 && step < 4 ? (
            <button className="btn-ghost" onClick={() => goToStep(step - 1)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft size={14} /> {t('backBtn', { defaultValue: 'Back' })}
            </button>
          ) : <div />}

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn-ghost btn-danger-hover" onClick={onCancel}>
              {t('cancelCreation')}
            </button>

            {step === 1 ? (
              <button
                className="btn-primary"
                disabled={!title}
                onClick={() => goToStep(2)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {t('nextStepBtn')} <ArrowRight size={14} />
              </button>
            ) : step === 2 ? (
              <button
                className="btn-primary"
                onClick={() => goToStep(3)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Select Template <ArrowRight size={14} />
              </button>
            ) : step === 3 ? (
              <button className="btn-primary" onClick={() => goToStep(4)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('assembleWorkspaceBtn')} <Sparkles size={14} />
              </button>
            ) : (
              <button
                className="btn-primary"
                disabled={true}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                Assembling... <ArrowRight size={14} />
              </button>
            )}
          </div>
        </footer>
      </div>

      {/* Template outline preview modal */}
      <>
        {previewModalTpl && (
          <div
            className="modal-backdrop"
            onClick={() => setPreviewModalTpl(null)}
          >
            <div
              className="modal-panel"
              style={{ maxWidth: 520 }}
              onClick={e => e.stopPropagation()}
            >
              <div className="modal-header">
                <span className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {getTemplateIcon(previewModalTpl.icon)} {previewModalTpl.name} {t('outlineHeader', { defaultValue: 'Outline' })}
                </span>
                <button className="modal-close" onClick={() => setPreviewModalTpl(null)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="modal-body" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: 16 }}>
                  {previewModalTpl.description}
                </p>

                {previewModalTpl.frontMatter.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    <span className="metadata-label" style={{ display: 'block', marginBottom: 6 }}>{t('frontMatterSheets')}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {previewModalTpl.frontMatter.map(fm => (
                        <span key={fm.id} className="feature-chip" style={{ fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <FileText size={12} /> {fm.label} {fm.auto && '(Auto)'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <span className="metadata-label" style={{ display: 'block', marginBottom: 6 }}>{t('chaptersOutline')}</span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {previewModalTpl.chapters.map((ch, idx) => (
                      <div key={ch.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.78rem', padding: '6px 10px', background: 'var(--bg)', borderRadius: '4px' }}>
                        <span style={{ fontWeight: 700, color: 'var(--text-faint)' }}>0{idx + 1}</span>
                        <span style={{ fontWeight: 600 }}>{ch.title}</span>
                        {ch.required && <span className="left-panel-item-badge" style={{ background: '#ba1a1a', color: '#ffffff', padding: '1.5px 4px', borderRadius: 2 }}>{t('required')}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="new-project-footer" style={{ padding: 12 }}>
                <button className="btn-primary btn-sm" onClick={() => setPreviewModalTpl(null)}>
                  {t('closeOutline')}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
