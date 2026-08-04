import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function PdfTesterPage() {
  const [file, setFile] = useState(null);
  const [markdown, setMarkdown] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [parseTimeMs, setParseTimeMs] = useState(null);
  const [activeTab, setActiveTab] = useState("raw"); // "raw" | "preview"

  // Parser configuration option
  // "opendataloader" = new-parser service using opendataloader-pdf
  // "pymupdf" = legacy pymupdf service
  const [parserOption, setParserOption] = useState("opendataloader");
  const [customUrl, setCustomUrl] = useState("http://localhost:8001/convert");

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

  const getTargetUrl = () => {
    if (parserOption === "opendataloader") {
      return "http://localhost:8001/convert";
    } else if (parserOption === "pymupdf") {
      return "http://localhost:8000/api/v1/to-markdown/raw";
    }
    return customUrl;
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a PDF file first.");
      return;
    }

    const endpoint = getTargetUrl();
    const parserName =
      parserOption === "opendataloader"
        ? "OpenDataLoader PDF (opendataloader-pdf)"
        : parserOption === "pymupdf"
        ? "PyMuPDF4LLM"
        : "Custom Parser Endpoint";

    setLoading(true);
    setStatusMsg(`Uploading PDF to ${parserName}...`);
    setError("");
    setMarkdown("");
    setParseTimeMs(null);

    console.log("[PdfTester] Starting upload to:", endpoint, "file:", file.name);

    const startTime = performance.now();

    try {
      const formData = new FormData();
      formData.append("file", file);

      if (parserOption === "pymupdf") {
        formData.append("resolve_math", "false");
      }

      setStatusMsg(`Parsing PDF with ${parserName} (OCR disabled)...`);

      const response = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      console.log("[PdfTester] Received response status:", response.status);

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(errText || `Server responded with status ${response.status}`);
      }

      const text = await response.text();
      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      console.log(`[PdfTester] Success! Length: ${text.length} chars, Time: ${duration}ms`);
      setMarkdown(text);
      setParseTimeMs(duration);
      setStatusMsg(`✓ Parsing complete in ${duration} ms!`);
    } catch (err) {
      console.error("[PdfTester] Parsing Error:", err);
      setError(
        err.message ||
          `Failed to connect to parser service at ${endpoint}. Ensure the server is running (e.g. 'python app.py' in new-parser).`
      );
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
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#0d1117",
        color: "#c9d1d9",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
        padding: "2rem",
      }}
    >
      <div style={{ maxWidth: "1050px", margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.5rem",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.8rem", color: "#58a6ff", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span>📄</span> PDF to Markdown Tester
            </h1>
            <p style={{ margin: "0.25rem 0 0 0", color: "#8b949e", fontSize: "0.95rem" }}>
              Test and compare PDF parsers (OpenDataLoader PDF & PyMuPDF4LLM)
            </p>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              padding: "0.5rem 1rem",
              backgroundColor: "#21262d",
              border: "1px solid #30363d",
              borderRadius: "6px",
              color: "#c9d1d9",
              cursor: "pointer",
              fontWeight: "500",
            }}
          >
            ← Back to App
          </button>
        </div>

        {/* Parser Selection Options */}
        <div
          style={{
            backgroundColor: "#161b22",
            border: "1px solid #30363d",
            borderRadius: "8px",
            padding: "1.25rem",
            marginBottom: "1.5rem",
          }}
        >
          <div style={{ fontSize: "0.95rem", fontWeight: "600", color: "#f0f6fc", marginBottom: "0.75rem" }}>
            Select PDF Parser Engine
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
            {/* Option 1: OpenDataLoader PDF */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "0.85rem 1rem",
                borderRadius: "6px",
                border: parserOption === "opendataloader" ? "2px solid #238636" : "1px solid #30363d",
                backgroundColor: parserOption === "opendataloader" ? "rgba(35, 134, 54, 0.1)" : "#0d1117",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="parserOption"
                  value="opendataloader"
                  checked={parserOption === "opendataloader"}
                  onChange={() => setParserOption("opendataloader")}
                />
                <span style={{ fontWeight: "600", color: "#58a6ff" }}>OpenDataLoader PDF</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    backgroundColor: "#238636",
                    color: "#fff",
                    padding: "2px 6px",
                    borderRadius: "10px",
                    fontWeight: "600",
                  }}
                >
                  NEW
                </span>
              </div>
              <span style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "0.3rem" }}>
                github.com/opendataloader-project/opendataloader-pdf
              </span>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.4rem" }}>
                <span style={{ fontSize: "0.72rem", backgroundColor: "#21262d", padding: "2px 6px", borderRadius: "4px", color: "#a5d6ff" }}>
                  Fast Local Mode
                </span>
                <span style={{ fontSize: "0.72rem", backgroundColor: "#21262d", padding: "2px 6px", borderRadius: "4px", color: "#ff7b72" }}>
                  OCR: Disabled
                </span>
              </div>
            </label>

            {/* Option 2: PyMuPDF4LLM */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "0.85rem 1rem",
                borderRadius: "6px",
                border: parserOption === "pymupdf" ? "2px solid #1f6beb" : "1px solid #30363d",
                backgroundColor: parserOption === "pymupdf" ? "rgba(31, 107, 235, 0.1)" : "#0d1117",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="parserOption"
                  value="pymupdf"
                  checked={parserOption === "pymupdf"}
                  onChange={() => setParserOption("pymupdf")}
                />
                <span style={{ fontWeight: "600", color: "#c9d1d9" }}>PyMuPDF4LLM</span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    backgroundColor: "#30363d",
                    color: "#8b949e",
                    padding: "2px 6px",
                    borderRadius: "10px",
                  }}
                >
                  Legacy
                </span>
              </div>
              <span style={{ fontSize: "0.8rem", color: "#8b949e", marginTop: "0.3rem" }}>
                PyMuPDF markdown extraction service
              </span>
            </label>

            {/* Option 3: Custom Endpoint */}
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                padding: "0.85rem 1rem",
                borderRadius: "6px",
                border: parserOption === "custom" ? "2px solid #d29922" : "1px solid #30363d",
                backgroundColor: parserOption === "custom" ? "rgba(210, 153, 34, 0.1)" : "#0d1117",
                cursor: "pointer",
                transition: "all 0.2s",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <input
                  type="radio"
                  name="parserOption"
                  value="custom"
                  checked={parserOption === "custom"}
                  onChange={() => setParserOption("custom")}
                />
                <span style={{ fontWeight: "600", color: "#d29922" }}>Custom Endpoint</span>
              </div>
              <input
                type="text"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
                disabled={parserOption !== "custom"}
                placeholder="http://localhost:8000/convert"
                style={{
                  marginTop: "0.4rem",
                  padding: "0.3rem 0.5rem",
                  fontSize: "0.8rem",
                  backgroundColor: "#161b22",
                  border: "1px solid #30363d",
                  borderRadius: "4px",
                  color: "#c9d1d9",
                }}
              />
            </label>
          </div>

          <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#8b949e" }}>
            Target Service URL: <code style={{ color: "#79c0ff" }}>{getTargetUrl()}</code>
          </div>
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
            transition: "border-color 0.2s",
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
            <div
              style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                color: "#f0f6fc",
                marginBottom: "0.25rem",
              }}
            >
              {file ? file.name : "Click to choose a PDF file or drop it here"}
            </div>
            <div style={{ fontSize: "0.85rem", color: "#8b949e" }}>
              {file
                ? `${(file.size / 1024).toFixed(1)} KB`
                : "Supports standard PDF documents"}
            </div>
          </label>

          <div style={{ marginTop: "1.25rem" }}>
            <button
              onClick={handleUpload}
              disabled={!file || loading}
              style={{
                padding: "0.65rem 1.75rem",
                fontSize: "1rem",
                fontWeight: "600",
                backgroundColor: !file || loading ? "#23863680" : "#238636",
                color: "#ffffff",
                border: "none",
                borderRadius: "6px",
                cursor: !file || loading ? "not-allowed" : "pointer",
                boxShadow: "0 2px 8px rgba(35, 134, 54, 0.3)",
              }}
            >
              {loading
                ? "Parsing PDF to Markdown..."
                : `Convert with ${
                    parserOption === "opendataloader"
                      ? "OpenDataLoader PDF"
                      : parserOption === "pymupdf"
                      ? "PyMuPDF4LLM"
                      : "Custom Parser"
                  }`}
            </button>
          </div>

          {statusMsg && (
            <div
              style={{
                marginTop: "1rem",
                color: "#58a6ff",
                fontSize: "0.9rem",
                fontWeight: "500",
              }}
            >
              {statusMsg}
            </div>
          )}
        </div>

        {/* Error Alert */}
        {error && (
          <div
            style={{
              padding: "1rem",
              backgroundColor: "rgba(248, 81, 73, 0.15)",
              border: "1px solid #f85149",
              borderRadius: "6px",
              color: "#ff7b72",
              marginBottom: "1.5rem",
            }}
          >
            ⚠️ <strong>Error:</strong> {error}
          </div>
        )}

        {/* Markdown Output View */}
        {markdown && (
          <div
            style={{
              backgroundColor: "#161b22",
              border: "1px solid #30363d",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            {/* Header Toolbar */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "0.75rem 1rem",
                backgroundColor: "#21262d",
                borderBottom: "1px solid #30363d",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <div style={{ fontSize: "0.9rem", fontWeight: "600", color: "#79c0ff" }}>
                  Parsed Output ({markdown.length.toLocaleString()} chars,{" "}
                  {markdown.split("\n").length} lines
                  {parseTimeMs ? ` · ${parseTimeMs}ms` : ""})
                </div>

                {/* View Tabs */}
                <div style={{ display: "flex", gap: "0.25rem", backgroundColor: "#0d1117", padding: "2px", borderRadius: "6px" }}>
                  <button
                    onClick={() => setActiveTab("raw")}
                    style={{
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.8rem",
                      backgroundColor: activeTab === "raw" ? "#21262d" : "transparent",
                      color: activeTab === "raw" ? "#58a6ff" : "#8b949e",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Raw Markdown
                  </button>
                  <button
                    onClick={() => setActiveTab("preview")}
                    style={{
                      padding: "0.25rem 0.6rem",
                      fontSize: "0.8rem",
                      backgroundColor: activeTab === "preview" ? "#21262d" : "transparent",
                      color: activeTab === "preview" ? "#58a6ff" : "#8b949e",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    Rendered Preview
                  </button>
                </div>
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
                  cursor: "pointer",
                }}
              >
                {copied ? "✓ Copied!" : "📋 Copy Raw Markdown"}
              </button>
            </div>

            {activeTab === "raw" ? (
              <textarea
                readOnly
                value={markdown}
                rows={25}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  backgroundColor: "#0d1117",
                  color: "#e6edf3",
                  fontFamily:
                    "ui-monospace, SFMono-Regular, SF Mono, Menlo, Consolas, Liberation Mono, monospace",
                  fontSize: "0.9rem",
                  padding: "1rem",
                  border: "none",
                  resize: "vertical",
                  outline: "none",
                  lineHeight: "1.5",
                }}
              />
            ) : (
              <div
                style={{
                  padding: "1.5rem",
                  backgroundColor: "#0d1117",
                  color: "#c9d1d9",
                  maxHeight: "500px",
                  overflowY: "auto",
                  lineHeight: "1.6",
                  whiteSpace: "pre-wrap",
                  fontFamily: "sans-serif",
                }}
              >
                {markdown}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

