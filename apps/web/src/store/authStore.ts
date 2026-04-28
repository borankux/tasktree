import { create } from 'zustand';
import type { User } from '@tasktree/shared';

interface AuthStore {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  hydrated: boolean;
  hydrate: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  token: null,
  user: null,
  hydrated: false,

  hydrate: () => {
    const token = localStorage.getItem('tasktree_token');
    const userStr = localStorage.getItem('tasktree_user');
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr) as User;
        set({ token, user, hydrated: true });
      } catch {
        localStorage.removeItem('tasktree_token');
        localStorage.removeItem('tasktree_user');
        set({ hydrated: true });
      }
    } else {
      set({ hydrated: true });
    }
  },

  setAuth: (token, user) => {
    localStorage.setItem('tasktree_token', token);
    localStorage.setItem('tasktree_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('tasktree_token');
    localStorage.removeItem('tasktree_user');
    set({ token: null, user: null });
  },
}));
