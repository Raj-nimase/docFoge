import { useCallback } from 'react';
import useAcaStore from '../../store';
import { compileProject, pollUntilDone, fetchCompiledPdf } from '../../api';

export default function TopBar({ onGoToDashboard }) {
  const currentProject = useAcaStore(s => s.getCurrentProject());
  const compileJob     = useAcaStore(s => s.compileJob);
  const setCompileJob  = useAcaStore(s => s.setCompileJob);
  const showToast      = useAcaStore(s => s.showToast);

  const isCompiling = compileJob?.status === 'pending' || compileJob?.status === 'processing';
  const isDone      = compileJob?.status === 'done';

  const handleCompile = useCallback(async () => {
    if (!currentProject || isCompiling) return;

    setCompileJob({ status: 'pending', jobId: null, blobUrl: null, error: null });

    try {
      const { jobId } = await compileProject(currentProject);
      setCompileJob({ status: 'processing', jobId });

      const final = await pollUntilDone(jobId, status => {
        setCompileJob(prev => ({ ...prev, ...status }));
      }, { intervalMs: 1500, maxAttempts: 30 });

      if (final.status === 'done') {
        const blobUrl = await fetchCompiledPdf(jobId);
        setCompileJob({ status: 'done', jobId, blobUrl });
        showToast('success', '✓ PDF compiled successfully!');
      } else {
        setCompileJob({ status: 'failed', error: final.error });
        showToast('error', `Compile failed: ${final.error}`);
      }
    } catch (err) {
      setCompileJob({ status: 'failed', error: err.message });
      showToast('error', `Compile error: ${err.message}`);
    }
  }, [currentProject, isCompiling, setCompileJob, showToast]);

  const handleDownload = () => {
    if (!compileJob?.blobUrl) return;
    const safeTitle = (currentProject?.metadata?.title || 'document').replace(/[^a-z0-9 ]/gi, '_');
    const a = document.createElement('a');
    a.href = compileJob.blobUrl;
    a.download = `${safeTitle}.pdf`;
    a.click();
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button className="topbar-logo" onClick={onGoToDashboard} title="Back to Dashboard">
          <span className="topbar-logo-icon">⬡</span>
          <span className="topbar-logo-name">AcaDoc</span>
        </button>
        <span className="topbar-sep" />
        <span className="topbar-project-name">
          {currentProject?.metadata?.title || 'Untitled Document'}
        </span>
      </div>

      <div className="topbar-right">
        {isDone && (
          <button className="btn-ghost btn-sm" onClick={handleDownload}>
            ↓ Download PDF
          </button>
        )}
        <button
          id="btn-compile"
          className={`btn-compile ${isCompiling ? 'btn-compile--loading' : ''}`}
          onClick={handleCompile}
          disabled={isCompiling || !currentProject}
        >
          {isCompiling ? (
            <>
              <span className="compile-spinner" />
              Compiling…
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Compile
            </>
          )}
        </button>
      </div>
    </header>
  );
}
