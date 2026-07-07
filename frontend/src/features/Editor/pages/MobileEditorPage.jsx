import { useEffect, useState } from "react";
import ChapterEditor from "@/features/Editor/components/ChapterEditor/ChapterEditor";
import useAcaStore from "@/contexts/projectStore/projectStore";

export default function MobileEditorPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // We mock the document body style to remove scrollbars and extra padding
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    
    // Disable pinch-to-zoom
    let meta = document.querySelector('meta[name="viewport"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'viewport';
      document.head.appendChild(meta);
    }
    meta.content = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no';

    // Set a flag so the Editor components know they are in mobile context if needed
    window.__IS_MOBILE_WEBVIEW__ = true;

    const handleMessage = (event) => {
      try {
        let data;
        // Handle both raw string messages and parsed objects
        if (typeof event.data === "string") {
          data = JSON.parse(event.data);
        } else {
          data = event.data;
        }

        if (data.type === "init") {
          // Mock the project and active section in the store
          useAcaStore.setState({
            projects: [
              {
                id: "mobile-project",
                chapters: [{ id: "mobile-chapter", content: data.content }],
                frontMatter: [],
                metadata: {}
              },
            ],
            currentProjectId: "mobile-project",
            activeChapterId: "mobile-chapter",
          });
          setReady(true);
        }
      } catch (e) {
        // Ignore parsing errors for non-JSON messages (like webpack-dev-server messages)
      }
    };

    window.addEventListener("message", handleMessage);
    document.addEventListener("message", handleMessage);

    // Tell React Native we are ready to receive initial content
    setTimeout(() => {
      window.ReactNativeWebView?.postMessage(JSON.stringify({ type: "ready" }));
    }, 100);

    return () => {
      window.removeEventListener("message", handleMessage);
      document.removeEventListener("message", handleMessage);
    };
  }, []);

  const handleContentChange = (json) => {
    window.ReactNativeWebView?.postMessage(
      JSON.stringify({ type: "update", content: json })
    );
  };

  if (!ready) {
    return (
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center' }}>
        <span>Loading Editor...</span>
      </div>
    );
  }

  return (
    <div className="mobile-editor-wrapper" style={{ height: "100vh", width: "100vw", backgroundColor: "#fff", display: "flex", flexDirection: "column" }}>
      <ChapterEditor
        sectionId="mobile-chapter"
        onContentChange={handleContentChange}
      />
    </div>
  );
}
