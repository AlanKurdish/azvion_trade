import { create } from 'zustand';
import api from '../lib/api';

interface AuthState {
  user: any | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isAuthenticated: !!localStorage.getItem('admin_token'),
  isLoading: false,

  login: async (phone, password) => {
    set({ isLoading: true });
    try {
      const { data } = await api.post('/auth/login', { phone, password });
      if (data.user.role !== 'ADMIN') {
        throw new Error('Access denied. Admin only.');
      }
      localStorage.setItem('admin_token', data.accessToken);
      localStorage.setItem('admin_refresh_token', data.refreshToken);
      set({ user: data.user, isAuthenticated: true });
    } finally {
      set({ isLoading: false });
    }
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: () => {
    const token = localStorage.getItem('admin_token');
    set({ isAuthenticated: !!token });
  },
}));
