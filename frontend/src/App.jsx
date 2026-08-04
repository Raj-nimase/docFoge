import { useState, useEffect, useRef } from "react";
import useAcaStore from "@/contexts/projectStore/projectStore";
import * as api from "@/services/api";
import useAuthStore from "@/contexts/authStore/authStore";
import DashboardLayout from "@/features/Dashboard/pages/DashboardLayout";
import DashboardHomePage from "@/features/Dashboard/pages/DashboardHomePage";
import StarredPage from "@/features/Dashboard/pages/StarredPage";
import TrashPage from "@/features/Dashboard/pages/TrashPage";
import SettingsPage from "@/features/Dashboard/pages/SettingsPage";
import NewProject from "@/features/NewProject/pages/NewProjectPage";
import Editor from "@/features/Editor/pages/EditorPage";
import Auth from "@/features/Auth/pages/AuthPage";
import LandingPage from "@/features/Landing/pages/LandingPage";
import RequireAuth from "@/components/RequireAuth/RequireAuth";
import Toast from "@/components/Toast/Toast";
import MobileEditorPage from "@/features/Editor/pages/MobileEditorPage";
import PdfTesterPage from "@/pages/PdfTesterPage";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";


export default function App() {
  const authStatus = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const signedIn = authStatus === "authenticated";
  const logout = useAuthStore((s) => s.logout);
  const loadProjectsForUser = useAcaStore((s) => s.loadProjectsForUser);
  const resetProjects = useAcaStore((s) => s.resetProjects);
  const showToast = useAcaStore((s) => s.showToast);

  const [booting, setBooting] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  // keep latest location in a ref so the post-login effect can read
  // state.from without re-running on every navigation
  const locationRef = useRef(location);
  locationRef.current = location;

  // Track previous auth status so we can distinguish "initial bootstrap"
  // from an actual login transition and avoid redundant project fetches.
  const prevAuthRef = useRef(authStatus);




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
    const prev = prevAuthRef.current;
    prevAuthRef.current = authStatus;

    if (authStatus === "authenticated") {
      // Only force-refresh when this is an actual login transition
      // (e.g. guest/unauthenticated → authenticated), NOT on initial
      // bootstrap where the bootstrap effect already loads projects.
      const isLoginTransition = prev !== null && prev !== "loading" && prev !== "authenticated";
      if (isLoginTransition) {
        loadProjectsForUser(true);
      }
      // ensure we're on the app after sign in (return to the guarded page if we came from one)
      if (window.location.pathname === "/auth") {
        navigate(locationRef.current.state?.from || "/dashboard", { replace: true });
      }
    }
  }, [authStatus, loadProjectsForUser, navigate]);

  const handleLogout = async () => {
    await logout();
    await resetProjects(true);
    navigate("/");
    showToast("success", "Signed out successfully.");
  };

  const handleAuthSuccess = async () => {
    const result = await loadProjectsForUser(true); // force=true: fresh cloud fetch after login
    navigate("/dashboard");
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

  if (window.location.pathname === "/mobile-editor") {
    return <MobileEditorPage />;
  }

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

  return (
    <>
      <Routes>
        {/* landing is for new/logged-out visitors; signed-in users go straight to the app */}
        <Route
          path="/"
          element={signedIn ? <Navigate to="/dashboard" replace /> : <LandingPage />}
        />
        <Route
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardLayout
                onNewProject={() => navigate("/new-project")}
                onLogout={signedIn ? handleLogout : undefined}
              />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardHomePage />} />
          <Route path="starred" element={<StarredPage />} />
          <Route path="trash" element={<TrashPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="templates" element={<Navigate to="/dashboard" replace />} />
          <Route path="exports" element={<Navigate to="/dashboard" replace />} />
        </Route>
        <Route
          path="/new-project"
          element={
            <RequireAuth>
              <NewProject
                onCreated={() => navigate("/editor")}
                onCancel={() => navigate("/dashboard")}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/editor"
          element={
            <RequireAuth>
              <Editor
                onGoToDashboard={() => navigate("/dashboard")}
                onLogout={signedIn ? handleLogout : undefined}
              />
            </RequireAuth>
          }
        />
        <Route
          path="/auth"
          element={
            <Auth
              allowDismiss
              onDismiss={() => navigate("/")}
              onSuccess={handleAuthSuccess}
            />
          }
        />
        <Route
          path="/pdf-test"
          element={<PdfTesterPage />}
        />
        {/* Legacy bookmarks from when the dashboard lived at "/" */}
        <Route path="/starred" element={<Navigate to="/dashboard/starred" replace />} />
        <Route path="/trash" element={<Navigate to="/dashboard/trash" replace />} />
        <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast />
    </>
  );
}
