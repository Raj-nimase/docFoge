import { useState, useCallback } from 'react';
import useDocStore from '../store';
import LivePreview from '../components/editor/LivePreview';
import { parseDocument, enqueueExport, pollExportUntilDone } from '../api';
import Spinner from '../components/ui/Spinner';

const SAMPLE_TEXT = `Introduction

Artificial intelligence is changing the world.

Applications
Chatbots
Image Generation
Code Generation
`;

export default function Workspace() {
  const rawText    = useDocStore(s => s.rawText);
  const setRawText = useDocStore(s => s.setRawText);
  const blocks     = useDocStore(s => s.blocks);
  const setBlocks  = useDocStore(s => s.setBlocks);
  const template   = useDocStore(s => s.template);
  const setTemplate = useDocStore(s => s.setTemplate);
  const exportJob  = useDocStore(s => s.exportJob);
  const setExportJob = useDocStore(s => s.setExportJob);
  const showToast  = useDocStore(s => s.showToast);
  const title      = useDocStore(s => s.title);
  const setTitle   = useDocStore(s => s.setTitle);

  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = useCallback(async () => {
    const trimmed = rawText.trim();
    if (!trimmed) {
      showToast('warning', 'Please enter some text first');
      return;
    }

    setIsGenerating(true);
    setExportJob({ status: 'pending', jobId: null });

    try {
      // 1. Parse Raw Text -> Blocks
      showToast('info', 'Structuring document...');
      const parseRes = await parseDocument(trimmed);
      const parsedBlocks = parseRes.blocks;
      
      // Update blocks in store so LivePreview updates its HTML view immediately
      setBlocks(parsedBlocks);
      
      // Attempt to extract title
      const firstHeading = parsedBlocks.find(b => b.type === 'heading');
      if (firstHeading) setTitle(firstHeading.content);

      // 2. Export Blocks -> PDF
      showToast('info', 'Compiling PDF...');
      const { jobId } = await enqueueExport({ 
        title: firstHeading ? firstHeading.content : title, 
        blocks: parsedBlocks, 
        template 
      });
      
      setExportJob({ status: 'processing', jobId });

      const final = await pollExportUntilDone(jobId, (status) => {
        setExportJob({ ...status, jobId });
      }, { intervalMs: 1200, maxAttempts: 50 });

      if (final.status === 'done') {
        const safeTitle = (title || 'document').replace(/[^a-z0-9 ]/gi, '_');
        const pdfApiUrl = `https://docfoge.onrender.com/api/documents/export/${jobId}/pdf`;

        // Fetch as Blob for same-origin blob URL
        const res = await fetch(pdfApiUrl);
        if (!res.ok) throw new Error(`PDF fetch failed: ${res.status}`);
        const blob = await res.blob();
        const pdfBlob = new Blob([blob], { type: 'application/pdf' });
        const blobUrl = URL.createObjectURL(pdfBlob);

        setExportJob({ status: 'done', jobId, blobUrl, safeTitle });
        showToast('success', '✓ PDF generated successfully!');

        // Trigger automatic download
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `${safeTitle}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        // Keep blob URL alive long enough for the browser to start the download
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
      } else {
        setExportJob({ status: 'failed', jobId, error: final.error });
        showToast('error', `Generation failed: ${final.error}`);
      }
    } catch (err) {
      setExportJob({ status: 'failed', error: err.message });
      showToast('error', `Process failed: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  }, [rawText, title, template, setExportJob, showToast, setBlocks, setTitle]);

  return (
    <div className="workspace-layout">
      {/* ── Left Pane: Input ───────────────────────────────────────── */}
      <div className="workspace-input-pane">
        <div className="workspace-header">
          <div className="workspace-logo">⬡ DocForge</div>
          <select 
            className="template-select" 
            value={template} 
            onChange={e => setTemplate(e.target.value)}
          >
            <option value="report">Project Report</option>
            <option value="ieee">IEEE Paper</option>
            <option value="assignment">Assignment</option>
          </select>
        </div>

        <div className="workspace-editor-container">
          <textarea
            className="raw-textarea"
            placeholder="Paste your raw text here..."
            value={rawText}
            onChange={e => setRawText(e.target.value)}
            spellCheck={false}
          />
        </div>

        <div className="workspace-footer">
          <button 
            className="btn-ghost" 
            onClick={() => setRawText(SAMPLE_TEXT)}
          >
            Try Sample
          </button>
          <button 
            className="btn-primary" 
            onClick={handleGenerate}
            disabled={isGenerating || !rawText.trim()}
          >
            {isGenerating ? <><Spinner size={16} color="#fff" /> Generating...</> : 'Generate PDF Preview →'}
          </button>
        </div>
      </div>

      {/* ── Right Pane: Live Preview ───────────────────────────────── */}
      <div className="workspace-preview-pane">
        <LivePreview onDownload={handleGenerate} exportJob={exportJob} />
      </div>
    </div>
  );
}
