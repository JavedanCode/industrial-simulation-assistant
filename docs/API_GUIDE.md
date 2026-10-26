# API guide for teammates

Everything the mobile app (or Postman, curl, or a future client) needs to talk to
the backend. The backend is plain HTTP + JSON under `/api`. There is no auth, no
API key in the client, and no cloud dependency for report analysis.

If you only want to run the app, read [mobile/API_INTEGRATION.md](../mobile/API_INTEGRATION.md).
This document is the HTTP contract and a manual test script.

---

## 1. Start the backend

From the repository root (Node 24+):

```bash
npm install
cp .env.example .env      # PowerShell: Copy-Item .env.example .env
npm run build
npm start
```

Default address: `http://localhost:3000`. The SQLite database is created at
`data/assistant.db` on first start.

Pick an AI provider in `.env`:

| `AI_PROVIDER` | Needs                    | Use for                                  |
| ------------- | ------------------------ | ---------------------------------------- |
| `mock`        | nothing                  | API/UI work with no model                |
| `ollama`      | Ollama running locally   | demos, offline, no cost, no rate limits  |
| `gemini`      | `GEMINI_API_KEY` + net   | cloud fallback when no local model fits  |

Report upload and analysis work the same for all three. Only chat messages call
the provider. Changing providers requires a backend restart.

---

## 2. Base URL

| Client                      | URL                                |
| --------------------------- | ---------------------------------- |
| Postman on the same machine | `http://localhost:3000/api`        |
| Phone / another device      | `http://<computer-LAN-IP>:3000/api` |

`localhost` on a phone means the phone itself. Find the LAN address with
`ipconfig` (IPv4 Address, e.g. `192.168.1.16`). The server already listens on all
interfaces, so no code change is needed. Allow Node through the Windows firewall
for private networks the first time.

In the app, this address is editable under Settings → **Backend connection**.
That is the quickest way to point an installed build at a different computer:
type `http://<LAN-IP>:3000/api` (or just `<LAN-IP>:3000`), then **Save and test**.
The saved value lives on the phone; `EXPO_PUBLIC_API_URL` is only the default
baked in at build time.

---

## 3. Endpoints

Every route is prefixed with `/api`. Unknown routes return `404` with
`{ "error": "Route not found: GET /api/..." }`.

### `GET /api/health`

Liveness check. Used by the app's **Settings → Backend connection → Save and test**.

```json
{ "status": "ok" }
```

### `POST /api/reports/analyze`

Upload one Arena report and get its analysis back in the same request.

- `Content-Type: multipart/form-data`
- Field name: `report` (exactly one file)
- Allowed: `.xlsx`, `.xlsm` (convert `.xls` first)
- Max size: 10 MB
- Optional header: `Idempotency-Key: <uuid>`

```bash
curl -X POST http://localhost:3000/api/reports/analyze ^
  -H "Idempotency-Key: 6f1d0c1e-7d4d-4a0e-9e0f-2b6f7f1c9a11" ^
  -F "report=@local-reports/arena-example-1.xlsm"
```

Response `201`:

```json
{
  "reportId": "0d8f5f0e-6a1f-4a63-9a2a-3d0f4c8b7e11",
  "report": { "...": "normalized workbook tables" },
  "semantics": { "projectName": "MilkShake Shop", "timeUnitLabel": "minutes" },
  "insights": {
    "schemaVersion": 1,
    "timeUnitLabel": "minutes",
    "replicationCount": 10,
    "confidenceInterval": 0.95,
    "resources": [
      {
        "name": "MilkShake_Maker",
        "scheduledUtilization": {
          "average": 0.82,
          "halfWidth": 0.01,
          "halfWidthStatus": "available",
          "minimum": 0.79,
          "maximum": 0.85
        }
      }
    ],
    "queues": [],
    "entities": [],
    "system": { "numberOut": { "average": 120 } },
    "bottleneck": {
      "resource": { "name": "MilkShake_Maker", "utilization": 0.82, "utilizationType": "scheduled" },
      "queue": null,
      "summary": "MilkShake_Maker is the most utilized resource at 82%."
    },
    "notes": []
  }
}
```

Notes:

- The response is large because it includes the normalized report. The mobile app
  only renders `semantics` and `insights`.
- Re-sending the same bytes with the same `Idempotency-Key` returns the original
  response instead of creating a second report.
- Reusing a key with *different* bytes returns `409`.
- A file that is not a readable Arena report returns `422` `REPORT_PARSE_FAILED`.

### `GET /api/reports`

List stored reports (server-side library, newest first). The phone keeps its own
library and does not use this to populate the UI.

```json
{ "reports": [{ "reportId": "…", "fileName": "arena-example-1.xlsm", "createdAt": "…" }] }
```

### `GET /api/reports/:reportId`

Same shape as the analyze response, plus `fileName` and `createdAt`.

### `DELETE /api/reports/:reportId`

Deletes the stored report and its conversations. `204 No Content`.

### `POST /api/reports/:reportId/conversations`

Create a conversation for a stored report.

```json
{ "title": "Optional title" }
```

`title` is optional (1-200 chars); the first message becomes the title if it is
omitted. Optional `Idempotency-Key: <uuid>`.

Response `201`:

```json
{
  "conversation": {
    "conversationId": "d92c2278-7132-467a-9a3e-00d989380e09",
    "reportId": "0d8f5f0e-6a1f-4a63-9a2a-3d0f4c8b7e11",
    "title": null,
    "createdAt": "2026-10-23T18:30:00.000Z"
  }
}
```

### `GET /api/reports/:reportId/conversations`

```json
{ "conversations": [ { "conversationId": "…", "title": "…" } ] }
```

### `GET /api/conversations/:conversationId`

Load the conversation and its messages, oldest first. This is what the app's
**Refresh conversation** button calls.

```json
{
  "conversation": { "conversationId": "…", "reportId": "…", "title": "…" },
  "messages": [
    { "messageId": "…", "conversationId": "…", "role": "user", "content": "Where is the bottleneck?", "createdAt": "…" },
    { "messageId": "…", "conversationId": "…", "role": "assistant", "content": "…", "createdAt": "…" }
  ]
}
```

### `POST /api/conversations/:conversationId/messages`

Ask a question. The backend builds the grounded prompt, calls the configured
provider, stores both messages, and returns them.

```json
{ "content": "Where is the bottleneck and why?", "clientMsgId": "optional-uuid" }
```

- `content`: 1-10,000 characters (trimmed).
- `clientMsgId`: optional, but **always send one** from real clients. Repeating
  the same ID with the same content returns the stored user message and the
  already-generated reply, so a retry after a lost response cannot duplicate a
  question or pay for a second generation.

Response `201`:

```json
{
  "userMessage": { "messageId": "000dbcde-…", "role": "user", "content": "Where is the bottleneck and why?", "createdAt": "…" },
  "assistantMessage": { "messageId": "0834d9b9-…", "role": "assistant", "content": "…", "createdAt": "…" }
}
```

One request may take a while with a local model (cold start, long report). The
mobile client allows up to 330 seconds; Postman's default timeout is unlimited,
so let it run.

If another message is already generating for the same conversation, the request
fails fast with `409 REPLY_PENDING` instead of queueing.

### `DELETE /api/conversations/:conversationId`

`204 No Content`.

### Legacy endpoints

Kept for older experiments, not used by the mobile app:

- `POST /api/reports/parse` with `{ "reportText": "..." }`
- `POST /api/chat` with the original chat payload (requires an existing
  conversation and ignores client-supplied `history`)

---

## 4. Postman walkthrough

1. Create a collection and one environment with:
   - `baseUrl` = `http://localhost:3000/api`
   - `reportId` = (empty)
   - `conversationId` = (empty)
   - `clientMsgId` = (empty)
2. **GET** `{{baseUrl}}/health` → expect `200` and `{"status":"ok"}`.
3. **POST** `{{baseUrl}}/reports/analyze`
   - Body → form-data → key `report`, type **File**, value
     `local-reports/arena-example-1.xlsm`
   - Header `Idempotency-Key` → generate a UUID (Postman: `{{$guid}}`)
   - Tests tab: `pm.collectionVariables.set("reportId", pm.response.json().reportId);`
4. **POST** `{{baseUrl}}/reports/{{reportId}}/conversations`
   - Body → raw JSON → `{ "title": "Bottleneck review" }`
   - Header `Idempotency-Key` → `{{$guid}}`
   - Tests: `pm.collectionVariables.set("conversationId", pm.response.json().conversation.conversationId);`
5. **POST** `{{baseUrl}}/conversations/{{conversationId}}/messages`
   - Body → raw JSON:
     ```json
     { "content": "Where is the bottleneck and why?", "clientMsgId": "{{$guid}}" }
     ```
   - Save the generated GUID in a variable first if you want to retry the same
     message exactly: `clientMsgId` must stay the same for a replay.
6. **GET** `{{baseUrl}}/conversations/{{conversationId}}` → both messages are
   present, roles alternate `user`/`assistant`.

Expected answers for the bundled samples:

| Report                    | Question                        | Expect                                                |
| ------------------------- | ------------------------------- | ----------------------------------------------------- |
| `arena-example-2.xlsm`    | "Where is the bottleneck?"      | names `MilkShake_Maker` (~82%) and `Billing Counter.Queue` |
| `arena-example-1.xlsm`    | "Where is the bottleneck?"      | no bottleneck; all utilization/throughput are zero    |

Run the same flow twice with the same `Idempotency-Key`/`clientMsgId` and confirm
the IDs and message count do not change.

### curl equivalents (Windows `cmd`)

```bat
curl http://localhost:3000/api/health

curl -X POST http://localhost:3000/api/reports/analyze ^
  -H "Idempotency-Key: %RANDOM%-1111-4111-8111-111111111111" ^
  -F "report=@local-reports/arena-example-1.xlsm"

curl -X POST http://localhost:3000/api/reports/<reportId>/conversations ^
  -H "Content-Type: application/json" ^
  -H "Idempotency-Key: %RANDOM%-2222-4222-8222-222222222222" ^
  -d "{\"title\":\"Bottleneck review\"}"

curl -X POST http://localhost:3000/api/conversations/<conversationId>/messages ^
  -H "Content-Type: application/json" ^
  -d "{\"content\":\"Where is the bottleneck and why?\",\"clientMsgId\":\"%RANDOM%-3333-4333-8333-333333333333\"}"

curl http://localhost:3000/api/conversations/<conversationId>
```

`Idempotency-Key` and `clientMsgId` must be real UUIDs; anything else returns
`400`.

---

## 5. Error codes

Errors always look like `{ "error": "human readable", "code": "OPTIONAL_CODE" }`.

| Status | Code                             | Meaning                                                    |
| ------ | -------------------------------- | ---------------------------------------------------------- |
| `400`  | —                                | Bad JSON, bad UUID, missing file, or invalid field         |
| `400`  | `MISSING_REPORT_FILE`            | No `report` field in the multipart body                    |
| `409`  | —                                | Idempotency key reused with different content              |
| `409`  | `REPLY_PENDING`                  | A reply for this conversation is already generating        |
| `413`  | `LIMIT_FILE_SIZE`                | Upload larger than 10 MB                                   |
| `422`  | `REPORT_PARSE_FAILED`            | File is not a readable Arena Excel report                  |
| `404`  | —                                | Report, conversation, or route not found                   |
| `500`  | `AI_PROVIDER_NOT_CONFIGURED`     | `AI_PROVIDER=gemini` but `GEMINI_API_KEY` is missing       |
| `502`  | `AI_PROVIDER_UNAVAILABLE`        | Ollama not running, or the provider returned 5xx           |
| `502`  | `AI_PROVIDER_MODEL_NOT_FOUND`    | Ollama model not pulled, or Gemini model name is wrong     |
| `502`  | `AI_PROVIDER_AUTH_FAILED`        | Gemini rejected the key                                    |
| `502`  | `AI_PROVIDER_REQUEST_FAILED`     | Provider rejected the request (e.g. context too long)      |
| `502`  | `AI_PROVIDER_INVALID_RESPONSE`   | Provider returned unreadable JSON                          |
| `502`  | `AI_PROVIDER_EMPTY_RESPONSE`     | Provider returned no text                                  |
| `502`  | `AI_RESPONSE_BLOCKED`            | Gemini safety filter blocked the answer                    |
| `503`  | `AI_PROVIDER_RATE_LIMITED`       | Gemini free-tier quota hit                                 |
| `504`  | `AI_PROVIDER_TIMEOUT`            | Provider exceeded its configured timeout                   |

Every response also carries `X-Request-Id`; the backend logs the same ID with
method, path, status, and duration, which makes it easy to match a Postman
response to a server log line.

---

## 6. Troubleshooting

**`Couldn’t reach the backend` from the phone**

- Use the computer's LAN IP, not `localhost`.
- Open Settings → **Backend connection** and check the address shown there. A
  saved address wins over `EXPO_PUBLIC_API_URL`, so an old address from a
  previous Wi-Fi network is a common cause.
- Phone and computer on the same Wi-Fi, and the network is not "guest/isolated".
- Allow Node through the Windows firewall on private networks.
- VPNs (including Cloudflare WARP) can route or block LAN traffic. Disable them
  for the demo if the phone cannot connect.
- Open `http://<LAN-IP>:3000/api/health` in the phone's browser to isolate app
  problems from network problems.
- In Settings, **Use the built-in address** drops a saved override. Editing
  `.env.local` still requires an Expo reload (`r` in the CLI, or restart).

**Chat hangs or returns `AI_PROVIDER_TIMEOUT`**

- Local: cold model load plus a long prompt can exceed the timeout. Raise
  `OLLAMA_TIMEOUT_MS`, use a smaller model, or warm it up with a short question.
- Cloud: free-tier Gemini can take over a minute. `GEMINI_TIMEOUT_MS=90000` is a
  sane value.
- Watch the backend log line (`POST /api/conversations/... 201 76000ms`) to see
  whether the time is in the provider call.

**`AI_PROVIDER_UNAVAILABLE`**

- `ollama list` should show the configured `OLLAMA_MODEL`.
- `Test-NetConnection localhost -Port 11434` should succeed.
- Check the model tag matches exactly (including `:3b-instruct`).

**`AI_PROVIDER_MODEL_NOT_FOUND`**

- `ollama pull <model>` then restart nothing (Ollama picks it up), just retry.

**Reports rejected**

- Only `.xlsx`/`.xlsm`, max 10 MB, and the workbook must contain the Arena report
  structure the parser recognizes (Summary/Resource/Queue/Entity statistics
  sheets). An arbitrary Excel file returns `422`.

---

## 7. Suggested smoke test order

1. `GET /health` on the computer.
2. `GET /health` from the phone's browser using the LAN IP.
3. Upload both sample reports; confirm different bottleneck summaries.
4. Create a conversation; send a question; confirm citations of real metric
   names and values from the analysis.
5. Refresh the conversation; confirm exactly one user + one assistant message.
6. Replay the same message (`clientMsgId`) and the same upload
   (`Idempotency-Key`); confirm no duplicates.
7. Stop Ollama, send a message, confirm a readable `AI_PROVIDER_UNAVAILABLE`, then
   start it again and retry successfully.
8. Repeat steps 3-6 in the phone app.
