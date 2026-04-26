import { create } from 'zustand';
import api from '../lib/api';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
  otpPhone: string | null;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('admin_token'),
  isLoading: false,
  otpPhone: null,

  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      await api.post('/auth/login', { phone, password });
      set({ otpPhone: phone });
    } finally {
      // Always clear the loading flag — even on error — so the button
      // doesn't stay disabled if credentials are wrong or the network fails.
      set({ isLoading: false });
    }
  },

  verifyOtp: async (phone, code) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/verify-otp', { phone, code });
      if (data.user.role !== 'ADMIN') {
        throw new Error('Access denied. Admin only.');
      }
      localStorage.setItem('admin_token', data.accessToken);
      localStorage.setItem('admin_refresh_token', data.refreshToken);
      set({ user: data.user, isAuthenticated: true, otpPhone: null });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, isAuthenticated: false, otpPhone: null });
  },

  checkAuth: () => {
    const token = localStorage.getItem('admin_token');
    set({ isAuthenticated: !!token });
  },
}));
