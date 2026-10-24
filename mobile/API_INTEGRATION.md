# Running the connected mobile app

## Start both applications

Use Node 24 or newer. Install dependencies in the repository root and in `mobile` (`npm ci` in each directory).

From the repository root:

```cmd
npm run build
npm start
```

The server defaults to port 3000. Configure its `.env` using the root `.env.example`. Use `AI_PROVIDER=mock` for integration tests; set the provider and keys only on the backend for actual AI responses.

In `mobile/.env.local` set your computer's Wi-Fi IPv4 address:

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.35:3000/api
```

This was the computer's address during integration. Check `ipconfig` if it changes. The phone and computer must be on the same reachable network. `localhost` on a phone points to the phone, not the computer. Reload Expo after changing the URL. Existing linked reports remember their API URL to avoid sending their IDs to a different backend.

From `mobile`:

```cmd
npx expo start
```

In Settings, tap **Test connection**. You can also open `http://<computer-IP>:3000/api/health` in the phone's browser; it should return `{"status":"ok"}`. If it fails, check the server, network/VPN routing, and Windows' private-network access for Node. A successful check on the computer alone does not prove phone connectivity.

## End-to-end device checks

1. Select a valid Arena `.xlsx` or `.xlsm` report of at most 10 MB. Ordinary spreadsheets can be rejected if they lack the Arena report structure. `.xls` must be converted first.
2. Preview and submit. The document saves locally, then uploads. Navigate back to Reports while processing; reopen the same report and verify analysis, tables, and utilization values.
3. Ask a question. Leave/reopen the chat while waiting. Confirm one question and one reply, then use Refresh conversation.
4. Restart the app. Confirm linked report IDs, cached analysis, drafts and chat persist on the phone. An interrupted operation should offer a retry rather than an endless spinner.
5. Stop the backend, submit/send, and verify a readable failure. Restart it and retry: the same upload/conversation/question must not be duplicated.
6. Try an invalid workbook and an oversized file. Confirm clear errors and no false success.
7. Rename a report and remove a local report. Renaming is local. Deletion removes only the device copy/chat; it does not delete server records or the user's original Excel file.
8. Verify light/dark appearance, keyboard, long responses, table scrolling and copying on the target phone.

## Integration behavior

- `src/api` owns transport, timeouts, runtime response checks, and API mapping. No AI credentials are in the mobile bundle.
- The upload field is `report`. Analysis returns `{ reportId, report, semantics, insights }`. Conversation creation returns `{ conversation }`; sending returns `{ userMessage, assistantMessage }`.
- A persisted local report UUID is reused as the `Idempotency-Key` for uploading and conversation creation. The backend stores receipts transactionally. Messages send `clientMsgId`; the backend reuses the same stored user/reply on retry. These are backward-compatible additions to the existing API.
- New SQLite metadata retains existing report rows. Earlier local/demo messages are archived separately when server history is loaded, rather than passed off as real analysis.
- The current Reports list is the device's library, not an import of every report on the server. The web build keeps that library in memory; refresh clears local access to it. Full account/device synchronization is not implemented.
- The API combines upload and analysis into one request. The UI does not invent percentage progress or promise execution while the operating system suspends/closes the app.
- Backend AI remains configurable (mock/Ollama/Gemini). HTTP integration tests use mock replies, not paid AI calls.

## Automated checks

From the root: `npm run typecheck`, `npm test`, and `npm run build`.

From `mobile`: `npx tsc --noEmit`, `npx expo lint`, and:

```cmd
node --test scripts/test-report-storage.cjs scripts/test-chat-storage.cjs scripts/test-analysis-format.cjs scripts/test-history-reconciliation.cjs
```

`tests/server/mobileApi.integration.test.ts` runs the real mobile transport/decoders against a temporary HTTP server and SQLite database. It covers valid/invalid uploads, analysis presentation, request replay after SQLite reopen, chat failure/retry, history, timeout, and invalid response shapes. It does not replace phone testing of the native picker, file URI upload, or keyboard.
