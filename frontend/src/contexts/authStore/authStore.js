import { create } from 'zustand';
import * as api from '@/services/api';
import {
  ensureTrialStarted,
  isGuestTrialActive,
  getTrialDaysRemaining,
  formatTrialRemaining,
  getTrialRemainingMs,
} from '@/utils/guestTrial';

const TOKEN_KEY = 'acadoc_token';

function loadToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || null;
  } catch {
    return null;
  }
}

function saveToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch (_) {}
}

export const useAuthStore = create((set, get) => ({
  user: null,
  token: loadToken(),
  status: 'idle', // idle | loading | authenticated | guest

  setAuth(token, user) {
    saveToken(token);
    set({ token, user, status: 'authenticated' });
  },

  clearAuth() {
    saveToken(null);
    set({ token: null, user: null, status: 'guest' });
  },

  isAuthenticated() {
    return get().status === 'authenticated';
  },

  isGuestTrialActive() {
    if (get().status === 'authenticated') return true;
    return isGuestTrialActive();
  },

  canAccessApp() {
    return get().isAuthenticated() || isGuestTrialActive();
  },

  getTrialDaysRemaining() {
    if (get().isAuthenticated()) return null;
    return getTrialDaysRemaining();
  },

  getTrialLabel() {
    if (get().isAuthenticated()) return null;
    return formatTrialRemaining();
  },

  async bootstrap() {
    const token = get().token || loadToken();
    if (!token) {
      ensureTrialStarted();
      set({ status: 'guest', token: null, user: null });
      return false;
    }

    set({ status: 'loading', token });
    try {
      const user = await api.getMe(token);
      set({ user, token, status: 'authenticated' });
      return true;
    } catch {
      saveToken(null);
      ensureTrialStarted();
      set({ token: null, user: null, status: 'guest' });
      return false;
    }
  },

  async register(payload) {
    const data = await api.register(payload);
    get().setAuth(data.token, data.user);
    return data.user;
  },

  async login(email, password) {
    const data = await api.login(email, password);
    get().setAuth(data.token, data.user);
    return data.user;
  },

  async resetPassword(email, newPassword) {
    const data = await api.resetPassword(email, newPassword);
    get().setAuth(data.token, data.user);
    return data.user;
  },

  logout() {
    get().clearAuth();
    ensureTrialStarted();
    // If trial already ended, canAccessApp becomes false until they sign in again
    if (getTrialRemainingMs() <= 0) {
      set({ status: 'guest' });
    }
  },

  async updateProfile(fields) {
    const user = await api.updateProfile(fields);
    set({ user });
    return user;
  },

  getInitials() {
    const name = get().user?.name || '';
    if (!name && get().status === 'guest') return 'G';
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return '?';
  },
}));

export default useAuthStore;
