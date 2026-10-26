# Mobile app

Expo Router app (Android/iOS, with a browser build for quick UI checks) for the
Industrial Simulation Assistant. It keeps a local report library, uploads an
Arena Excel report to the backend, shows the deterministic analysis, and chats
about it. No AI credentials live in this app.

## 1. Start the backend first

From the repository root:

```bash
npm install
cp .env.example .env
npm run build
npm start
```

See the root [README](../README.md) for choosing `mock`, `ollama`, or `gemini`
in `.env`.

## 2. Configure the API address

```bash
cp .env.example .env.local
```

Edit `mobile/.env.local` and use the computer's LAN IPv4 address, not
`localhost`:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.16:3000/api
```

`localhost` on a phone means the phone. This value is baked into the bundle at
build time, so a restart of `expo start` is the reliable way to apply it.

**On an installed app, edit it in the app instead.** Settings → Backend
connection lets you type the computer's address and tap **Save and test**. The
saved address is stored on that phone and wins over the built-in one, so a build
stays usable when the laptop's DHCP address changes. `192.168.1.16:3000` is
enough; `http://` and `/api` are filled in. **Use the built-in address** removes
the override.

Existing reports remember the backend that analysed them. Changing the address
makes them read-only until you change it back.

## 3. Run it

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go (phone and computer on the same Wi-Fi). Press `w`
for the browser build, `a` for an Android emulator, `i` for an iOS simulator
(macOS only).

If the phone cannot connect:

- open `http://<computer-IP>:3000/api/health` in the phone's browser;
- allow Node through the Windows firewall for private networks;
- disable VPNs/WARP, which can block LAN traffic;
- check Settings → **Backend connection** → **Save and test** in the app.

## 4. What to test on a device

See [API_INTEGRATION.md](API_INTEGRATION.md) for the full end-to-end checklist
(upload, background processing, restart persistence, retries, offline behavior,
invalid files, rename/delete, light/dark, keyboard, long replies). The HTTP
contract is in [../docs/API_GUIDE.md](../docs/API_GUIDE.md).

Quick smoke test:

1. Select `arena-example-2.xlsm` on Home → Preview → Submit.
2. Open the report; confirm the analysis view names `MilkShake_Maker` (~82%).
3. Ask "Where is the bottleneck and why?"; confirm the reply cites report values.
4. Kill and reopen the app; the report and chat are still there.
5. Stop the backend and send a message; confirm a readable error and a working
   retry after restarting it.

## 5. Layout

```text
src/
  api/          transport, response decoding, typed API calls
  app/          Expo Router screens (tabs, report detail, preview)
  components/   themed primitives and tab bar
  features/
    reports/    report library, storage, upload, chat, analysis rendering
    settings/   appearance and backend connection
  hooks/        theme helpers
```

## 6. Checks

```bash
npm test
npx tsc --noEmit
npx expo lint
npx expo-doctor
```

`npm test` runs the Node tests in `scripts/`; they load the real TypeScript
modules in a VM so no emulator is needed.

`env.d.ts` references `expo/types` so typechecking works before `expo start` has
generated the git-ignored `expo-env.d.ts`.

## 7. Build an installable app (EAS)

`eas.json` has two profiles:

| Profile      | Output                       | Use                                    |
| ------------ | ---------------------------- | -------------------------------------- |
| `preview`    | Internal APK                 | Install directly on an Android phone.  |
| `production` | Store build, auto-increment  | Play Store / App Store submission.     |

One-time setup:

```bash
npx eas-cli@latest login
npx eas-cli@latest build:configure   # writes extra.eas.projectId into app.json
```

EAS builds run in the cloud and do not see `mobile/.env.local` (it is git
ignored). Provide the default backend address as an EAS environment variable
for the `preview` environment:

```bash
npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL \
  --value http://192.168.1.16:3000/api --environment preview \
  --visibility plaintext
```

Build and install:

```bash
npx eas-cli@latest build --platform android --profile preview
```

The build page prints a QR code and a download link; open it on the Android
phone. The phone must be on the same Wi-Fi as the backend. If the address later
changes, edit it in Settings rather than rebuilding.

App identity: `Simulation Assistant`, package/bundle ID
`com.soren.industrialassistant`. An iOS build needs the paid Apple Developer
Program (ad-hoc or TestFlight); Android APKs are free to build and install.

## Notes

- The report list is this device's library, not every report on the server.
  There is no account system or sync; rename and delete are local-only.
- The browser build keeps its library in memory; a refresh clears it.
- The app talks to the backend over plain HTTP for local demos. A production
  build would need HTTPS, authentication, and a stable hosted endpoint.
