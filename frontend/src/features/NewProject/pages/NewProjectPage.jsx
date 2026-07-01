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

  // Stepper state: 1 to 4 (Details → Template → Content → Assemble)
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

  // STEP 2: Template Selection
  const [selectedId, setSelectedId]   = useState('ieee-paper'); // Default template
  const [tplCategory, setTplCategory] = useState('All');
  const [tplSearch, setTplSearch]     = useState('');
  const [previewModalTpl, setPreviewModalTpl] = useState(null);

  // STEP 3: Content Outline Input
  const [draftContent, setDraftContent] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState([
    "Auto-Generate Abstract",
    "Convert to Formal Writing style",
    "Suggest Academic Section Headings"
  ]);

  // STEP 4: Preview & Compilation
  const [compilingLogs, setCompilingLogs] = useState([]);
  const [compileProgress, setCompileProgress] = useState(0);

  // Template metadata details fields mapper
  const [metadata, setMetadata] = useState({
    title: '',
    authors: user?.name || '',
    guide: '',
    department: user?.department || '',
    institution: user?.institution || '',
    year: new Date().getFullYear().toString(),
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

  // Step 4 simulated compilation logging
  useEffect(() => {
    if (step !== 4) return;

    setCompilingLogs([]);
    setCompileProgress(0);

    const logMessages = [
      { time: '12:04:01', msg: '📝 Preparing workspace drafts and file pipelines...', success: false },
      { time: '12:04:02', msg: `📦 Assembling chapters directory based on: ${selectedTpl.name}`, success: false },
      { time: '12:04:03', msg: `📂 Hydrating metadata values for authors: "${metadata.authors}"`, success: false },
      { time: '12:04:04', msg: `🪄 Ingesting draft texts: ${(draftContent || '').slice(0, 30)}...`, success: false },
      { time: '12:04:05', msg: '✨ Applying document layout and citation standards...', success: false },
      { time: '12:04:06', msg: `🛡️ Injecting LaTeX packages & standard styles...`, success: false },
      { time: '12:04:07', msg: '✅ LaTeX document workspace compiled successfully!', success: true }
    ];

    let currentLogIndex = 0;
    const logInterval = setInterval(() => {
      if (currentLogIndex < logMessages.length) {
        const nextLog = logMessages[currentLogIndex];
        setCompilingLogs(prev => [...prev, nextLog]);
        setCompileProgress(prev => Math.min(prev + 15, 100));
        currentLogIndex++;
      } else {
        clearInterval(logInterval);
        setCompileProgress(100);
      }
    }, 700);

    return () => clearInterval(logInterval);
  }, [step]);

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
            <span className="stepper-label">{t('wizardTemplate')}</span>
          </div>
          <span className={`stepper-line ${step > 2 ? 'stepper-line--active' : ''}`} />

          <div className={`stepper-node ${step === 3 ? 'stepper-node--active' : ''} ${step > 3 ? 'stepper-node--completed' : ''}`} onClick={() => step > 3 && goToStep(3)} style={{ cursor: step > 3 ? 'pointer' : 'default' }}>
            <span className="stepper-circle">{step > 3 ? <Check size={12} /> : "3"}</span>
            <span className="stepper-label">{t('wizardContent')}</span>
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

              {/* STEP 2: TEMPLATE SELECTOR */}
              {step === 2 && (
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

              {/* STEP 3: CONTENT OUTLINE WRITER */}
              {step === 3 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
                  <div className="dashboard-section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <FileCode size={18} style={{ color: 'var(--accent)' }} /> {t('step3Title')}
                  </div>

                  <div className="content-wizard-split">
                    
                    {/* Visual Editor canvas */}
                    <div className="editor-wizard-canvas">
                      <label className="metadata-label">{t('introContentLabel')}</label>
                      <textarea
                        className="editor-wizard-textarea"
                        placeholder={t('introPlaceholder')}
                        value={draftContent}
                        onChange={e => setDraftContent(e.target.value)}
                      />

                      {/* Simulated Upload dropzone */}
                      <div
                        className="dropzone-wizard"
                        onClick={() => setDraftContent("Uploaded from sample_paper.txt successfully.\n\nABSTRACT\nOptimizing citation metadata indexing inside standard LaTeX compilers using tectonic backends.")}
                        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20 }}
                      >
                        <UploadCloud size={28} style={{ color: 'var(--accent)', opacity: 0.7, marginBottom: 8 }} />
                        <span style={{ fontSize: '0.8rem' }}>{t('dragDropLabel')}<b style={{ color: 'var(--accent)' }}>{t('browse')}</b></span>
                      </div>
                    </div>

                    {/* AI Assistant Help panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <span className="metadata-label" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <Sparkles size={14} style={{ color: 'var(--accent)' }} /> {t('aiCreativeSuite')}
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {aiSuggestions.map((sug, idx) => (
                          <button
                            key={idx}
                            className="btn-ghost"
                            style={{ textAlign: 'left', fontSize: '0.78rem', justifyContent: 'flex-start', padding: 10, display: 'flex', alignItems: 'center', gap: 6 }}
                            onClick={() => handleAiAction(sug)}
                          >
                            <Sparkles size={12} style={{ color: 'var(--accent)', flexShrink: 0 }} />
                            <span>{t(sug, { defaultValue: sug })}</span>
                          </button>
                        ))}
                      </div>

                      <div className="ai-tip-card" style={{ marginTop: 10 }}>
                        <span className="ai-tip-header" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <Lightbulb size={13} style={{ color: 'var(--accent)' }} /> {t('proTip')}
                        </span>
                        <p className="ai-tip-desc">
                          {t('proTipDesc')}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* STEP 4: PREVIEW & ASSEMBLY */}
              {step === 4 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 640, margin: '0 auto', width: '100%', textAlign: 'center' }}>
                  <div className="dashboard-section-title">{t('step4Title')}</div>

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

            {step < 3 ? (
              <button
                className="btn-primary"
                disabled={step === 1 && !title}
                onClick={() => goToStep(step + 1)}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {t('nextStepBtn')} <ArrowRight size={14} />
              </button>
            ) : step === 3 ? (
              <button className="btn-primary" onClick={() => goToStep(4)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {t('assembleWorkspaceBtn')} <Sparkles size={14} />
              </button>
            ) : (
              <button
                className="btn-primary"
                disabled={compileProgress < 100}
                onClick={handleCreate}
                style={{ display: 'flex', alignItems: 'center', gap: 6 }}
              >
                {t('launchWorkspaceBtn')} <ArrowRight size={14} />
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
