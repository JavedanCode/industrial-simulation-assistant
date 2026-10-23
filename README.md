# Industrial Simulation Assistant

A local backend for analyzing Arena simulation reports and chatting about the
results. It uploads an Arena `.xlsx`/`.xlsm` report, normalizes the workbook,
computes deterministic metrics, stores everything in a local SQLite database,
and exposes a conversation API backed by a replaceable AI provider.

The backend is the source of truth. AI answers are grounded in report data and
computed insights, not in facts memorized by a model.

## Status

- Report parsing, normalization, storage, and library APIs: complete.
- Derived resource, queue, entity, throughput, and bottleneck insights: complete.
- Conversation and message APIs: complete.
- AI boundary with deterministic `mock` and hosted Gemini Flash providers: complete.
- Optional fine-tuning: not required for the first working chatbot.

## Requirements

- Node.js 24 or newer. The project uses the built-in `node:sqlite` module.
- npm.
- No external database or cloud service is required.

## Quick start

```bash
npm install
cp .env.example .env        # Windows PowerShell: Copy-Item .env.example .env
npm run build
npm start
```

The API listens on `http://localhost:3000` by default. Confirm it is running:

```bash
curl http://localhost:3000/api/health
```

```json
{ "status": "ok" }
```

The SQLite database is created automatically at `data/assistant.db`.

## Configuration

Copy `.env.example` to `.env` and adjust values as needed.

| Variable           | Default             | Description                                                     |
| ------------------ | ------------------- | --------------------------------------------------------------- |
| `PORT`             | `3000`              | HTTP port.                                                      |
| `DATA_DIR`         | `data`              | Directory used for local storage.                               |
| `DATABASE_PATH`    | `data/assistant.db` | Explicit SQLite path, or `:memory:` for tests.                  |
| `AI_PROVIDER`      | `mock`              | `mock` for offline use, or `gemini` for the hosted Flash model. |
| `GEMINI_API_KEY`   | unset               | Gemini API key. Required only when `AI_PROVIDER=gemini`.        |
| `GEMINI_MODEL`     | `gemini-3.8-flash`  | Gemini model identifier.                                        |
| `GEMINI_TIMEOUT_MS`| `30000`             | Request timeout in milliseconds (1000-120000).                  |
| `CORS_ORIGIN`      | `*`                 | Allowed browser origin.                                         |

Relative paths are resolved from the project root. The database stays on the
machine where the backend runs.

## API

All routes are under `/api`.

| Method   | Path                                      | Purpose                                      |
| -------- | ----------------------------------------- | -------------------------------------------- |
| `GET`    | `/health`                                 | Liveness check.                              |
| `POST`   | `/reports/analyze`                        | Upload, analyze, and store a report.         |
| `GET`    | `/reports`                                | List stored reports.                         |
| `GET`    | `/reports/:reportId`                      | Get a stored report and its analysis.        |
| `DELETE` | `/reports/:reportId`                      | Delete a report and its conversations.       |
| `POST`   | `/reports/:reportId/conversations`        | Create a conversation.                       |
| `GET`    | `/reports/:reportId/conversations`        | List a report's conversations.               |
| `GET`    | `/conversations/:conversationId`          | Get a conversation and its messages.         |
| `DELETE` | `/conversations/:conversationId`          | Delete a conversation.                       |
| `POST`   | `/conversations/:conversationId/messages` | Send a message and store the reply.          |

Errors use a JSON body with a human-readable `error`, and usually a stable
`code` plus optional validation `details`:

```json
{
  "error": "Invalid request body.",
  "code": "VALIDATION_ERROR",
  "details": [{ "path": "content", "message": "Too small: expected string to have >=1 characters" }]
}
```

Common statuses are `400` for validation or malformed IDs, `404` for missing
reports/conversations, `413` for oversized uploads, `422` for unreadable Arena
workbooks, `500` for configuration or unexpected server failures, and `502`,
`503`, or `504` when a hosted AI provider fails. Uploaded files must be `.xlsx`
or `.xlsm`.

### Upload and analyze a report

Send a multipart form with the file in the `report` field. Files must have an
`.xlsx` or `.xlsm` extension and be at most 10 MB.

```bash
curl -F "report=@local-reports/arena-example-2.xlsm" \
  http://localhost:3000/api/reports/analyze
```

The response contains the stored report ID, normalized workbook, semantic
summary, and derived insights:

```json
{
  "reportId": "0d0e1f8a-...",
  "report": {
    "schemaVersion": 1,
    "sourceFormat": "xlsm",
    "metadata": {
      "projectName": "Unnamed Project",
      "timeUnitLabel": "Minutes",
      "numberOfReplications": 50
    },
    "tables": {},
    "summary": {},
    "warnings": []
  },
  "semantics": {
    "projectName": "Unnamed Project",
    "declaredReplicationCount": 50
  },
  "insights": {
    "schemaVersion": 1,
    "timeUnitLabel": "Minutes",
    "replicationCount": 50,
    "confidenceInterval": 0.95,
    "resources": [],
    "queues": [],
    "entities": [],
    "system": {
      "numberOut": {
        "average": 31.14,
        "halfWidth": 1.2941,
        "halfWidthStatus": "available",
        "minimum": 21,
        "maximum": 39
      }
    },
    "bottleneck": {
      "resource": {
        "name": "MilkShake_Maker",
        "utilization": 0.8231,
        "utilizationType": "scheduled",
        "averageNumberScheduled": 1,
        "reasons": ["Scheduled utilization: 82.3%"]
      },
      "queue": {
        "name": "Billing Counter.Queue",
        "averageNumberWaiting": 3.055,
        "averageWaitingTime": 8.8691,
        "reasons": ["Average number waiting: 3.06"]
      },
      "summary": "The most utilized resource is \"MilkShake_Maker\" ..."
    },
    "notes": []
  }
}
```

`report` and `semantics` are shortened above; the actual response includes the
complete normalized tables and summary sections.

### Derived insights

Each metric is a `MetricSummary` with these fields:

- `average`: average across replications where available.
- `halfWidth`: confidence-interval half-width, or `null`.
- `halfWidthStatus`: `available`, `insufficient-data`, `correlated`, or `unknown`.
- `minimum` / `maximum`: observed range across replications.

The `insights` object contains:

- `resources`: scheduled and instantaneous utilization, scheduled units, busy
  units, and total seizures.
- `queues`: waiting time and number waiting.
- `entities`: number in/out, WIP, total time, wait time, value-added time,
  non-value-added time, transfer time, and other time.
- `system.numberOut`: overall system throughput.
- `bottleneck`: the highest-utilization resource and the most congested queue.

Resource utilization and queue congestion are reported separately instead of
being collapsed into one arbitrary score. A queue is linked to a resource only
when the names match reliably. When queue names cannot be linked, the queue is
still reported and a note explains that the connection could not be inferred.

Reports with no positive utilization or throughput produce `null` bottleneck
candidates rather than a fabricated answer.

### Conversation flow

```bash
# Create a conversation
curl -X POST http://localhost:3000/api/reports/<reportId>/conversations \
  -H "Content-Type: application/json" \
  -d '{"title":"Bottleneck review"}'

# Send a message
curl -X POST http://localhost:3000/api/conversations/<conversationId>/messages \
  -H "Content-Type: application/json" \
  -d '{"content":"Where is the bottleneck?"}'
```

The message response contains both stored messages:

```json
{
  "userMessage": {
    "messageId": "...",
    "conversationId": "...",
    "role": "user",
    "content": "Where is the bottleneck?",
    "createdAt": "..."
  },
  "assistantMessage": {
    "messageId": "...",
    "conversationId": "...",
    "role": "assistant",
    "content": "...",
    "createdAt": "..."
  }
}
```

Conversation history is owned by the server. The client does not need to resend
previous messages.

### Legacy endpoints

These remain for compatibility but should not be used by new clients:

- `POST /api/reports/parse` accepts `{ "reportText": "..." }` and returns a raw
  text wrapper.
- `POST /api/chat` accepts the old chat payload. It requires an existing
  conversation and ignores client-supplied `history`.

## Architecture

```text
src/
  models/                     Domain and normalized-report types
  server/
    ai/                       AiProvider boundary, prompt grounding, mock + Gemini
    controllers/              HTTP request/response handling
    http/                     AppError and validation helpers
    middleware/               CORS, logging, uploads, central error handling
    routes/                   Express route definitions
    services/                 Parsing, normalization, insights, conversations
    storage/                  SQLite schema and repositories
```

Report flow:

```text
Excel upload
  -> parser
  -> normalizer
  -> semantic summary
  -> derived insights
  -> SQLite report library
  -> conversation context
  -> AI provider
```

## AI integration

The AI boundary is intentionally small:

```ts
interface AiProvider {
  readonly name: string;
  generateReply(input: AiGenerationInput): Promise<string>;
}
```

`AiGenerationInput` includes the question, normalized report, semantic summary,
derived insights, and recent conversation history. Two providers ship with the
project:

- `mock` (the default) works entirely offline and returns deterministic,
  report-grounded text. It is used by the tests and is useful while setting up.
- `gemini` calls Gemini Flash's hosted API. It needs a free Google AI Studio API
  key, an internet connection, and `AI_PROVIDER=gemini`.

For a detailed, code-level explanation of how the Gemini request is assembled,
see [docs/AI_WALKTHROUGH.md](docs/AI_WALKTHROUGH.md).

### Enable Gemini Flash

1. Create an API key at <https://aistudio.google.com/apikey>.
2. Add these values to `.env` (never commit `.env`):

   ```dotenv
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_TIMEOUT_MS=30000
   ```

3. Restart the backend and send a conversation message.

The free tier's quotas and model availability can change, so check the current
limits in Google AI Studio. The backend makes one non-streaming request per
message and does not retry automatically. A `429` response is returned as a
clear `AI_PROVIDER_RATE_LIMITED` error so you can try again later.

If `GEMINI_API_KEY` is missing, the report library and deterministic analysis
still work; only chat requests fail with `AI_PROVIDER_NOT_CONFIGURED`.

### What gets sent to Gemini

The backend remains the source of truth. The prompt contains:

- project metadata and table row counts;
- a compact catalog of every continuous statistic with its average;
- the complete computed `insights` object;
- parser warnings;
- recent conversation history and the current question.

It does not send the original workbook, the complete normalized workbook, the
absolute path of the model file, or the API key inside the URL. The key is sent
in the `x-goog-api-key` header. Report fields are explicitly treated as
untrusted data so instruction-like text inside an uploaded workbook cannot
override the grounding rules.

The workbook and SQLite database remain local, but the compact prompt and chat
messages are sent to Google when Gemini is enabled. Google's current free tier
may use content to improve its products. Do not use the free tier for
confidential reports if that tradeoff is unacceptable; a paid Gemini tier or a
future local provider would avoid it.

The model is allowed to explain general simulation concepts, but it is told not
to attach report-specific numbers unless they appear in the supplied context.
If a requested value is absent, the correct answer is that the report does not
contain it.

### Add another provider

1. Implement `AiProvider` and call it with the structured report data.
2. Register it in `src/server/ai/index.ts`.
3. Add the provider name to the `AI_PROVIDER` enum in `src/config.ts`.
4. Keep the model prompt grounded in the supplied report/insights. Do not ask
   the model to recall values from its training data.

Fine-tuning is optional. A free hosted model or a local model with good
instruction following should be tried first, with the report data and computed
insights supplied as context.

## Tests

```bash
npm run typecheck
npm test
npm run build
```

Tests use an in-memory SQLite database. Integration tests read the Arena files
in `local-reports/` and are skipped automatically when those files are absent.
Generated diagnostics are written to `local-reports/generated/`, which is
ignored by git.

## Limitations

- Designed for a single local user. There is no authentication or rate limiting.
- The default AI provider is the deterministic mock. Gemini Flash is optional
  and requires an API key and network access.
- With Gemini enabled, report context and chat messages leave the machine. The
  free tier may use that content to improve Google's products.
- A failed Gemini request is not retried automatically. The API returns a stable
  error code instead of silently using stale data.
- Responses are non-streaming.
- The parser targets the Arena report layouts covered by the tests. Unknown
  worksheet layouts produce warnings instead of silently inventing data.
