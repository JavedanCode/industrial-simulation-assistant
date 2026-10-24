import Storage from "expo-sqlite/kv-store";

const KEY = "appearance-v1";
export const loadAppearance = () => Storage.getItemAsync(KEY);
export const saveAppearance = (value: string) =>
  Storage.setItemAsync(KEY, value);
