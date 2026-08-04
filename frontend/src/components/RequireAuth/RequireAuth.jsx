import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '@/contexts/authStore/authStore';

/**
 * Route guard: renders children only for authenticated users.
 * Unauthenticated visitors are sent to /auth, remembering where they
 * came from so the post-login effect in App.jsx can return them.
 */
export default function RequireAuth({ children }) {
  const isAuthenticated = useAuthStore((s) => s.status === 'authenticated');
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }
  return children;
}
