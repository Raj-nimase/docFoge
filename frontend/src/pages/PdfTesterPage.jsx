import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PdfTesterPage() {
  const [file, setFile] = useState(null);
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      if (selected.type !== "application/pdf" && !selected.name.endsWith(".pdf")) {
        setError("Please select a valid PDF file.");
        return;
      }
      setFile(selected);
      setError("");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      if (!selected.name.endsWith(".pdf")) {
        setError("Please drop a valid PDF file.");
        return;
      }
      setFile(selected);
      setError("");
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }

    setLoading(true);
    setStatusMsg("Uploading PDF to PyMuPDF4LLM service...");
    setError("");
    setMarkdown("");

    console.log("[PdfTester] Starting upload for file:", file.name, file.size, "bytes");

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("resolve_math", "false");

      setStatusMsg("Parsing PDF text into full rich Markdown...");

      const response = await fetch("http://localhost:8000/api/v1/to-markdown/raw", {
        method: "POST",
        body: formData,
      });

      console.log("[PdfTester] Received response status:", response.status);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server responded with status ${response.status}`);
      }

      const text = await response.text();
      console.log("[PdfTester] Successfully received markdown output. Length:", text.length);
      setMarkdown(text);
      setStatusMsg("✓ Parsing complete!");
    } catch (err) {
      console.error("[PdfTester] Parsing Error:", err);
      setError(err.message || "Failed to connect to PDF Parser service. Ensure uvicorn is running at http://localhost:8000");
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!markdown) return;
    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{
      minHeight: "100vh",
      backgroundColor: "#0d1117",
      color: "#c9d1d9",
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      padding: "2rem"
    }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#58a6ff" }}>PDF to Raw Markdown Tester</h1>
            <p style={{ margin: "0.25rem 0 0 0", color: "#8b949e", fontSize: "0.95rem" }}>
              Testing interface for PyMuPDF4LLM service (no editor/TiPTap integration)
            </p>
          </div>
          <button
            onClick={() => navigate("/")}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#21262d",
              border: "1px solid #30363d",
              borderRadius: "6px",
              color: "#c9d1d9",
              cursor: "pointer"
            }}
          >
            ← Back to App
          </button>
        </div>

        {/* Upload Box */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          style={{
            border: "2px dashed #30363d",
            borderRadius: "8px",
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#161b22",
            marginBottom: "1.5rem",
            transition: "border-color 0.2s"
          }}
        >
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            id="pdf-upload-input"
            style={{ display: "none" }}
          />
          <label htmlFor="pdf-upload-input" style={{ cursor: "pointer" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "0.5rem" }}>📄</div>
            <div style={{ fontSize: "1.1rem", fontWeight: "600", color: "#f0f6fc", marginBottom: "0.25rem" }}>
              {file ? file.name : "Click to choose a PDF file or drop it here"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#8b949e" }}>
              {file ? `${(file.size / 1024).toFixed(1)} KB` : "Supports standard PDF documents"}
            </div>
          </label>

          <div style={{ marginTop: "1.25rem" }}>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              style={{
                padding: "0.6rem 1.5rem",
                fontSize: "1rem",
                fontWeight: "600",
                backgroundColor: !file || loading ? "#23863680" : "#238636",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                cursor: !file || loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Parsing PDF to Markdown..." : "Convert to Markdown"}
            </button>
          </div>

          {statusMsg && (
            <div style={{ marginTop: "1rem", color: "#58a6ff", fontSize: "0.9rem", fontWeight: "500" }}>
              {statusMsg}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div style={{
            padding: "1rem",
            backgroundColor: "rgba(248, 81, 73, 0.15)",
            border: "1px solid #f85149",
            borderRadius: "6px",
            color: "#ff7b72",
            marginBottom: "1.5rem"
          }}>
            ⚠️ <strong>Error:</strong> {error}
          </div>
        )}

        {/* Raw Markdown Output */}
        {markdown && (
          <div style={{
            backgroundColor: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            overflow: "hidden"
          }}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.75rem 1rem",
              backgroundColor: "#21262d",
              borderBottom: "1px solid #30363d"
            }}>
              <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "#79c0ff" }}>
                Raw Markdown Output ({markdown.length.toLocaleString()} characters, {markdown.split("\n").length} lines)
              </div>
              <button
                onClick={handleCopy}
                style={{
                  padding: "0.4rem 0.8rem",
                  backgroundColor: copied ? "#238636" : "#30363d",
                  border: "none",
                  borderRadius: "4px",
                  color: "#ffffff",
                  fontSize: "0.85rem",
                  cursor: "pointer"
                }}
              >
                {copied ? "✓ Copied!" : "📋 Copy Raw Markdown"}
              </button>
            </div>

            <textarea
              readOnly
              value={markdown}
              rows={25}
              style={{
                width: "100%",
                boxSizing: "border-box",
                backgroundColor: "#0d1117",
                color: "#e6edf3",
                fontFamily: "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
                fontSize: "0.9rem",
                padding: "1rem",
                border: "none",
                resize: "vertical",
                outline: "none",
                lineHeight: "1.5"
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
