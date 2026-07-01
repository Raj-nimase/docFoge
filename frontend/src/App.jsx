import { useState, useEffect } from "react";
import useAcaStore from "@/contexts/projectStore/projectStore";
import * as api from "@/services/api";
import useAuthStore from "@/contexts/authStore/authStore";
import DashboardLayout from "@/features/Dashboard/pages/DashboardLayout";
import DashboardHomePage from "@/features/Dashboard/pages/DashboardHomePage";
import TemplatesPage from "@/features/Dashboard/pages/TemplatesPage";
import ExportsPage from "@/features/Dashboard/pages/ExportsPage";
import SettingsPage from "@/features/Dashboard/pages/SettingsPage";
import NewProject from "@/features/NewProject/pages/NewProjectPage";
import Editor from "@/features/Editor/pages/EditorPage";
import Auth from "@/features/Auth/pages/AuthPage";
import Toast from "@/components/Toast/Toast";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";


export default function App() {
  const authStatus = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const canAccessApp = useAuthStore((s) => s.canAccessApp);
  const signedIn = authStatus === "authenticated";
  const logout = useAuthStore((s) => s.logout);
  const loadProjectsForUser = useAcaStore((s) => s.loadProjectsForUser);
  const resetProjects = useAcaStore((s) => s.resetProjects);
  const showToast = useAcaStore((s) => s.showToast);

  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();




  useEffect(() => {
    let cancelled = false;
    (async () => {
      await bootstrap();
      if (cancelled) return;
      // show UI immediately after auth bootstrap completes
      setBooting(false);

      // do a short health check; if reachable, load cloud projects in background
      (async () => {
        try {
          await api.authFetch("/health", { timeoutMs: 1200, token: null });
          if (cancelled) return;
          await loadProjectsForUser();
        } catch (err) {
          console.log(
            "[app] backend health check failed — using local cache",
            err.message || err,
          );
        }
      })();
    })();
    return () => {
      cancelled = true;
    };
  }, [bootstrap, loadProjectsForUser]);

  useEffect(() => {
    if (authStatus === "authenticated") {
      loadProjectsForUser();
      // ensure we're on the app after sign in
      if (window.location.pathname === "/auth") navigate("/");
    }
  }, [authStatus, loadProjectsForUser, navigate]);

  const handleLogout = async () => {
    logout();
    resetProjects();
    await loadProjectsForUser();
    navigate("/");
    showToast(
      "success",
      "Signed out. Projects on this device are still available as a guest.",
    );
    if (!useAuthStore.getState().canAccessApp()) {
      navigate("/auth");
    }
  };

  const handleAuthSuccess = async () => {
    const result = await loadProjectsForUser();
    navigate("/");
    if (result?.offline) {
      showToast(
        "warning",
        "Signed in, but could not reach the server. Projects on this device only.",
      );
    } else if (result?.merged) {
      showToast("success", "Your local projects were saved to your account.");
    } else if (result?.count > 0) {
      showToast(
        "success",
        `Loaded ${result.count} project${result.count === 1 ? "" : "s"} from your account.`,
      );
    } else {
      showToast(
        "success",
        "Signed in. Your projects will sync across devices.",
      );
    }
  };

  if (booting || authStatus === "loading") {
    return (
      <div className="auth-page">
        <div className="auth-loading">
          <div
            className="preview-compile-spinner"
            style={{ width: 36, height: 36 }}
          />
          <span>Loading workspace…</span>
        </div>
      </div>
    );
  }

  if (!canAccessApp()) {
    return (
      <>
        <Auth trialExpired onSuccess={handleAuthSuccess} />
        <Toast />
      </>
    );
  }

  return (
    <>
      <Routes>
        <Route
          path="/"
          element={
            <DashboardLayout
              onNewProject={() => navigate("/new-project")}
              onLogout={signedIn ? handleLogout : undefined}
              onSignIn={() => navigate("/auth")}
            />
          }
        >
          <Route index element={<DashboardHomePage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="exports" element={<ExportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route
          path="/new-project"
          element={
            <NewProject
              onCreated={() => navigate("/editor")}
              onCancel={() => navigate("/")}
            />
          }
        />
        <Route
          path="/editor"
          element={
            <Editor
              onGoToDashboard={() => navigate("/")}
              onLogout={signedIn ? handleLogout : undefined}
            />
          }
        />
        <Route
          path="/auth"
          element={
            <Auth
              allowDismiss
              onDismiss={() => navigate(-1)}
              onSuccess={handleAuthSuccess}
            />
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}
