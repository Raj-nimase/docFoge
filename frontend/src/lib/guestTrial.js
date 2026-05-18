/** Guest free-trial window before sign-in is required */

export const GUEST_TRIAL_DAYS = 7;
const TRIAL_START_KEY = 'acadoc_trial_start';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function getTrialDurationMs() {
  return GUEST_TRIAL_DAYS * MS_PER_DAY;
}

export function ensureTrialStarted() {
  try {
    if (!localStorage.getItem(TRIAL_START_KEY)) {
      localStorage.setItem(TRIAL_START_KEY, String(Date.now()));
    }
  } catch (_) {}
}

export function getTrialStartTime() {
  ensureTrialStarted();
  try {
    const raw = localStorage.getItem(TRIAL_START_KEY);
    const n = Number(raw);
    return Number.isFinite(n) ? n : Date.now();
  } catch {
    return Date.now();
  }
}

export function getTrialRemainingMs() {
  const elapsed = Date.now() - getTrialStartTime();
  return Math.max(0, getTrialDurationMs() - elapsed);
}

export function isGuestTrialActive() {
  return getTrialRemainingMs() > 0;
}

export function getTrialDaysRemaining() {
  return Math.max(0, Math.ceil(getTrialRemainingMs() / MS_PER_DAY));
}

export function formatTrialRemaining() {
  const ms = getTrialRemainingMs();
  const days = Math.ceil(ms / MS_PER_DAY);
  if (days > 1) return `${days} days left`;
  if (days === 1) return '1 day left';
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours > 1) return `${hours} hours left`;
  return 'less than 1 hour left';
}
