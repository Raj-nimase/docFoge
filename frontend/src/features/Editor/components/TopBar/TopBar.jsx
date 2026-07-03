import { useCallback } from 'react';
import { LogOut, HelpCircle } from 'lucide-react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import useAuthStore from '@/contexts/authStore/authStore';
import { compileProject, pollUntilDone, fetchCompiledPdf } from '@/services/api';

export default function TopBar({ onGoToDashboard, onLogout, onStartTour }) {
  const signedIn = useAuthStore(s => s.status === 'authenticated');
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
      console.log(`[${new Date().toISOString()}] Step 1: Initiating compileProject for project ID: ${currentProject.id}`);
      const { jobId } = await compileProject(currentProject);
      console.log(`[${new Date().toISOString()}] Step 2: Received jobId: ${jobId}. Beginning polling...`);
      setCompileJob({ status: 'processing', jobId });

      const final = await pollUntilDone(jobId, status => {
        console.log(`[${new Date().toISOString()}] Step 3 (Poll): Status updated to ${status.status}`);
        setCompileJob(prev => ({ ...prev, ...status, _tick: Date.now() }));
      }, { intervalMs: 1500, maxAttempts: 30 });

      if (final.status === 'done') {
        const backendTime = final.durationMs ? `${(final.durationMs / 1000).toFixed(2)}s` : 'unknown';
        console.log(`[${new Date().toISOString()}] Step 4: Job marked done on backend. (Backend compile time: ${backendTime}). Fetching PDF blob...`);
        const blobUrl = await fetchCompiledPdf(jobId);
        console.log(`[${new Date().toISOString()}] Step 5: PDF blob generated on frontend. Displaying!`);
        setCompileJob({ status: 'done', jobId, blobUrl });
        showToast('success', '✓ PDF compiled successfully!');
      } else {
        const backendTime = final.durationMs ? `${(final.durationMs / 1000).toFixed(2)}s` : 'unknown';
        console.log(`[${new Date().toISOString()}] Compile failed on backend. (Backend took: ${backendTime}): ${final.error}`);
        setCompileJob({ status: 'failed', error: final.error });
        showToast('error', `Compile failed: ${final.error}`);
      }
    } catch (err) {
      console.log(`[${new Date().toISOString()}] Compile error caught: ${err.message}`);
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
          <span className="topbar-logo-name display-heading">AcaDoc</span>
        </button>
        <span className="topbar-sep" />
        <span className="topbar-project-name">
          {currentProject?.metadata?.title || 'Untitled Document'}
        </span>
      </div>

      <div className="topbar-right">
        {signedIn && onLogout && (
          <button type="button" className="btn-ghost btn-sm topbar-signout" title="Sign out" onClick={onLogout}>
            <LogOut size={14} />
            Sign out
          </button>
        )}
        {isDone && (
          <button type="button" className="btn-ghost btn-sm" onClick={handleDownload}>
            ↓ Download PDF
          </button>
        )}
        {onStartTour && (
          <button type="button" className="btn-ghost btn-sm topbar-tour-btn" onClick={onStartTour} title="Editor tour">
            <HelpCircle size={16} />
            Tour
          </button>
        )}
        <button
          id="tour-compile-btn"
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
