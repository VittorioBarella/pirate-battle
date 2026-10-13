export function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`pb:${key}`);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function write<T>(key: string, value: T) {
  localStorage.setItem(`pb:${key}`, JSON.stringify(value));
}
