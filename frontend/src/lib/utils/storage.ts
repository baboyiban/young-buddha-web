// lib/utils/storage.ts
export class Storage {
  private static isAvailable(): boolean {
    try {
      const test = "__storage_test__";
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  static get<T>(key: string, defaultValue: T): T {
    if (!this.isAvailable()) return defaultValue;

    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch {
      return defaultValue;
    }
  }

  static set<T>(key: string, value: T): void {
    if (!this.isAvailable()) return;

    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Silently fail
    }
  }

  static remove(key: string): void {
    if (!this.isAvailable()) return;

    try {
      localStorage.removeItem(key);
    } catch {
      // Silently fail
    }
  }

  static clear(): void {
    if (!this.isAvailable()) return;

    try {
      localStorage.clear();
    } catch {
      // Silently fail
    }
  }
}
