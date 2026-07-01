import useAcaStore from '@/contexts/projectStore/projectStore';

const TYPE_STYLES = {
  success: 'bg-emerald-600/90 text-white border-emerald-500/30',
  error:   'bg-red-600/90 text-white border-red-500/30',
  info:    'bg-sky-600/90 text-white border-sky-500/30',
  warning: 'bg-amber-500/90 text-white border-amber-400/30',
};

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    'ℹ',
  warning: '⚠',
};

export default function Toast() {
  const toast      = useAcaStore(s => s.toast);
  const clearToast = useAcaStore(s => s.clearToast);

  if (!toast) return null;

  return (
    <div
      key={toast.id}
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-9999 flex items-center gap-2.5 px-5 py-3 rounded-xl border backdrop-blur-md shadow-lg cursor-pointer transition-all duration-300 animate-[slideUp_0.35s_ease-out] ${TYPE_STYLES[toast.type] || TYPE_STYLES.info}`}
      onClick={clearToast}
      role="alert"
    >
      <span className="text-base leading-none">{ICONS[toast.type] || ICONS.info}</span>
      <span className="text-sm font-medium">{toast.message}</span>
    </div>
  );
}
