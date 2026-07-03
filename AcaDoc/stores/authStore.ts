/**
 * Auth Store
 * Persists JWT in expo-secure-store so it survives app restarts.
 * On mount, loads the stored token and re-validates it with /auth/me.
 */
import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import {
  apiLogin,
  apiRegister,
  apiResetPassword,
  apiGetMe,
  apiUpdateProfile,
  setToken,
  User,
} from '@/services/api';

const TOKEN_KEY = 'acadoc_jwt';

type Status = 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  status: Status;
  user: User | null;
  token: string | null;

  // Actions
  bootstrap: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (fields: {
    name: string; email: string; password: string;
    role?: string; institution?: string; department?: string;
  }) => Promise<void>;
  resetPassword: (email: string, newPassword: string) => Promise<void>;
  updateProfile: (fields: Partial<Pick<User, 'name' | 'role' | 'institution' | 'department'>>) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  token: null,

  /** Called once from the root layout on app start. */
  bootstrap: async () => {
    try {
      const stored = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!stored) {
        set({ status: 'unauthenticated' });
        return;
      }
      setToken(stored);
      const user = await apiGetMe();
      set({ status: 'authenticated', user, token: stored });
    } catch {
      // Token expired or invalid — clear it
      await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
      setToken(null);
      set({ status: 'unauthenticated', user: null, token: null });
    }
  },

  login: async (email, password) => {
    const { token, user } = await apiLogin(email, password);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setToken(token);
    set({ status: 'authenticated', user, token });
  },

  register: async (fields) => {
    const { token, user } = await apiRegister(fields);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setToken(token);
    set({ status: 'authenticated', user, token });
  },

  resetPassword: async (email, newPassword) => {
    const { token, user } = await apiResetPassword(email, newPassword);
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    setToken(token);
    set({ status: 'authenticated', user, token });
  },

  updateProfile: async (fields) => {
    const user = await apiUpdateProfile(fields);
    set({ user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setToken(null);
    set({ status: 'unauthenticated', user: null, token: null });
  },
}));
