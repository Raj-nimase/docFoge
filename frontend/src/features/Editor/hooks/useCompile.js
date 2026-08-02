import { useCallback } from 'react';
import useAcaStore from '@/contexts/projectStore/projectStore';
import { setCompileActive } from '@/contexts/projectStore/projectStore';
import { compileProject, pollUntilDone, fetchCompiledPdf } from '@/services/api';
import { splitSingleDocToProject } from '@/features/Editor/components/ChapterEditor/docUtils';

/**
 * Shared compile / download logic (extracted from TopBar).
 * Used by the Ribbon compile button, the ⌘/Ctrl+Enter shortcut,
 * and the Command Palette.
 */
export default function useCompile() {
  const currentProject = useAcaStore(s => s.getCurrentProject());
  const compileJob     = useAcaStore(s => s.compileJob);
  const setCompileJob  = useAcaStore(s => s.setCompileJob);
  const showToast      = useAcaStore(s => s.showToast);

  const isCompiling = compileJob?.status === 'pending' || compileJob?.status === 'processing';
  const isDone      = compileJob?.status === 'done';

  const compile = useCallback(async () => {
    if (!currentProject || isCompiling) return;

    setCompileJob({ status: 'pending', jobId: null, blobUrl: null, error: null });
    setCompileActive(true);   // pause background project sync while compiling

    try {
      // Flush live editor content to projectStore immediately before compiling
      const editorInstance = useAcaStore.getState().editorInstance;
      if (editorInstance && !editorInstance.isDestroyed) {
        const fullJson = editorInstance.getJSON();
        const live = useAcaStore.getState().getCurrentProject();
        if (live) {
          const res = splitSingleDocToProject(
            fullJson,
            live.frontMatter || [],
            live.chapters || []
          );
          useAcaStore.getState().updateProjectDocument(res.frontMatter, res.chapters);
        }
      }

      const freshProject = useAcaStore.getState().getCurrentProject() || currentProject;

      // Sync project to the cloud before compilation
      const syncActiveProjectNow = useAcaStore.getState().syncActiveProjectNow;
      if (syncActiveProjectNow) {
        await syncActiveProjectNow();
      }

      console.log(`[${new Date().toISOString()}] Step 1: Initiating compileProject for project ID: ${freshProject.id}`);
      const { jobId } = await compileProject(freshProject);
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
    } finally {
      setCompileActive(false);  // resume background sync after compile finishes
    }
  }, [currentProject, isCompiling, setCompileJob, showToast]);

  const download = useCallback(() => {
    if (!compileJob?.blobUrl) return;
    const safeTitle = (currentProject?.metadata?.title || 'document').replace(/[^a-z0-9 ]/gi, '_');
    const a = document.createElement('a');
    a.href = compileJob.blobUrl;
    a.download = `${safeTitle}.pdf`;
    a.click();
  }, [compileJob?.blobUrl, currentProject?.metadata?.title]);

  return { compile, download, isCompiling, isDone, hasProject: !!currentProject };
}
