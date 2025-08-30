// 공유 인증 캐시
const authCache = new Map<string, { valid: boolean; ts: number; data?: any }>();
const CACHE_TTL = 60 * 1000; // 60초

export const AuthCache = {
  get: (key: string) => {
    const cached = authCache.get(key);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.ts < CACHE_TTL) {
      return cached;
    }

    authCache.delete(key);
    return null;
  },

  set: (key: string, value: { valid: boolean; data?: any }) => {
    authCache.set(key, { ...value, ts: Date.now() });
  },

  delete: (key: string) => {
    authCache.delete(key);
  },

  clear: () => {
    authCache.clear();
  },
};