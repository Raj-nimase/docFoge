import { useMemo } from 'react';
import { LogOut, CloudCheck, FileText } from 'lucide-react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import useAuthStore from '@/contexts/authStore/authStore';

export default function TopBar({ onGoToDashboard, onLogout }) {
  const signedIn = useAuthStore(s => s.status === 'authenticated');
  const currentProject = useAcaStore(s => s.getCurrentProject());
  const activeSection  = useAcaStore(s => s.getActiveSection());

  // Calculate live word count & page estimate
  const { wordCount, pageEstimate } = useMemo(() => {
    if (!currentProject) return { wordCount: 0, pageEstimate: 1 };
    let totalWords = 0;
    const extractText = (obj) => {
      if (!obj) return;
      if (typeof obj === 'string') {
        totalWords += obj.trim().split(/\s+/).filter(Boolean).length;
      } else if (Array.isArray(obj)) {
        obj.forEach(extractText);
      } else if (typeof obj === 'object') {
        if (obj.text) totalWords += obj.text.trim().split(/\s+/).filter(Boolean).length;
        if (obj.content) extractText(obj.content);
      }
    };
    extractText(currentProject.frontMatter);
    extractText(currentProject.chapters);
    return {
      wordCount: totalWords,
      pageEstimate: Math.max(1, Math.ceil(totalWords / 280)),
    };
  }, [currentProject]);

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-logo" onClick={onGoToDashboard} title="Back to Dashboard">
          <span className="topbar-logo-icon">⬡</span>
          <span className="topbar-logo-name display-heading">AcaDoc</span>
        </button>
        <span className="topbar-sep" />
        <div className="editor-panel-breadcrumb topbar-breadcrumb">
          <span className="breadcrumb-project">
            {currentProject?.metadata?.title || 'Untitled Document'}
          </span>
          <span className="breadcrumb-sep">›</span>
          <span className="breadcrumb-chapter">
            {activeSection?.title || activeSection?.label || 'Document'}
          </span>
        </div>
      </div>

      <div className="topbar-right">
        {/* Telemetry Pill */}
        <div className="topbar-telemetry-pill" title="Document statistics">
          <FileText size={13} />
          <span>{wordCount.toLocaleString()} words</span>
          <span>•</span>
          <span>~{pageEstimate} pgs</span>
        </div>

        <div className="topbar-telemetry-pill topbar-saved-pill" title="Cloud Auto-Sync Active">
          <CloudCheck size={13} />
          <span>Saved</span>
        </div>

        {signedIn && onLogout && (
          <button type="button" className="btn-ghost btn-sm topbar-signout" title="Sign out" onClick={onLogout}>
            <LogOut size={14} />
            Sign out
          </button>
        )}
      </div>
    </header>
  );
}
