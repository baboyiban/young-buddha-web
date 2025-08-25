// 날짜를 항상 'YYYY-MM-DD'로 정규화
export function toYMD(v: any): string {
  if (!v) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return shortDate(dt);
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    if (m) {
      const y = parseInt(m[3], 10);
      const mo = parseInt(m[1], 10) - 1;
      const d = parseInt(m[2], 10);
      return shortDate(new Date(y, mo, d));
    }
    return s;
  }
  if (v instanceof Date) return shortDate(v);
  if (typeof v === "number") {
    const base = Date.UTC(1899, 11, 30);
    const ms = base + v * 86400000;
    return shortDate(new Date(ms));
  }
  return String(v);
}

export function shortDate(dt: Date): string {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// 추가: id 정규화 헬퍼
export function normalizeId(id: string): string {
  return String(id)
    .trim()
    .replace(/\u200B|\u200C|\u200D|\uFEFF/g, "")
    .normalize("NFKC");
}

export function generateUniqueId(): string {
  return `REQ-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}