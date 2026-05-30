import { create } from 'zustand';

const useStore = create((set, get) => ({
  // ─── Auth ───
  user: null,
  accessToken: localStorage.getItem('accessToken') || null,
  refreshToken: localStorage.getItem('refreshToken') || null,
  isAuthenticated: !!localStorage.getItem('accessToken'),

  setAuth: (user, accessToken, refreshToken) => {
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    set({ user, accessToken, refreshToken, isAuthenticated: true });
  },

  clearAuth: () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  setUser: (user) => set({ user }),

  // ─── Tokens ───
  tokens: [],
  setTokens: (tokens) => set({ tokens }),

  // ─── Vault Keys ───
  vaultKeys: [],
  setVaultKeys: (vaultKeys) => set({ vaultKeys }),

  // ─── Audit Logs ───
  auditLogs: [],
  auditStats: null,
  setAuditLogs: (auditLogs) => set({ auditLogs }),
  setAuditStats: (auditStats) => set({ auditStats }),
}));

export default useStore;
