/// <reference types="expo/types" />

// Expo generates `expo-env.d.ts` the first time you run `expo start`, and that
// file is git-ignored. This committed reference keeps `npx tsc --noEmit`
// working in a fresh clone (for CI and for teammates who have not started the
// dev server yet). It declares CSS module imports and other Expo globals.
