const KEY = "industrial-assistant-appearance-v1";

// Browser preferences can persist without enabling the native SQLite bridge.
export async function loadAppearance() {
  return window.localStorage.getItem(KEY);
}
export async function saveAppearance(value: string) {
  window.localStorage.setItem(KEY, value);
}
