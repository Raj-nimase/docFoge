import { useEffect } from 'react';
import useAcaStore from '../../store';

export default function Toast() {
  const toast = useAcaStore(s => s.toast);
  const clearToast = useAcaStore(s => s.clearToast);

  if (!toast) return null;

  const icons = {
    success: '✓',
    error: '✕',
    info: 'ℹ',
    warning: '⚠',
  };

  return (
    <div
      key={toast.id}
      className={`toast toast-${toast.type}`}
      onClick={clearToast}
      role="alert"
    >
      <span className="toast-icon">{icons[toast.type] || icons.info}</span>
      <span className="toast-message">{toast.message}</span>
    </div>
  );
}
