# How the AI layer works

This walkthrough explains the path from a chat message to a Gemini Flash answer.
It is meant to be read alongside the code in `src/server/ai/`.

The short version:

```text
POST /api/conversations/:id/messages
  -> conversation service loads the report and recent messages
  -> prompt builder creates grounding rules + a compact report context
  -> Gemini provider sends a stateless REST request
  -> backend stores the returned text as an assistant message
```

The backend, not the model, owns the report facts.

## 1. Why there are two providers

`src/server/ai/types.ts` defines the boundary:

```ts
interface AiProvider {
  readonly name: string;
  generateReply(input: AiGenerationInput): Promise<string>;
}
```

`AiGenerationInput` contains the question, the normalized report, the semantic
summary, the derived insights, and recent conversation history.

The `mock` provider is the default. It returns deterministic text built directly
from the report. It lets the whole application run and be tested without an API
key or internet connection. The `gemini` provider uses the same input but sends
it to a hosted model for a natural-language answer.

`src/server/ai/index.ts` chooses the provider from `AI_PROVIDER`. If `gemini` is
selected without `GEMINI_API_KEY`, chat requests fail with a clear
`AI_PROVIDER_NOT_CONFIGURED` error. Report upload and deterministic analysis
still work.

## 2. What the conversation service sends

`src/server/services/conversationService.ts` does four important things before
the provider is called:

1. Finds the report and its stored analysis.
2. Loads the most recent 20 messages from SQLite.
3. Appends and stores the new user message.
4. Calls the selected `AiProvider`.

The history is passed as role/content pairs. The current question is passed
separately. The provider does not read the database itself; that keeps storage
and model integration independent.

If an older stored report has no derived insights, the service builds them from
the normalized report before calling the provider. This is the same backfill
behavior used by the report API.

## 3. Building a grounded prompt

`src/server/ai/promptBuilder.ts` produces two things:

- `systemInstruction`: behavior rules plus the report context.
- `history` and `question`: the conversation turns.

Gemini's REST API is stateless. Every HTTP request starts with no memory of the
previous one. Putting the report context and rules in `systemInstruction` means
the context is present on every request, even after the conversation grows.

The context is deliberately compact. It contains:

- project name, model run date, time unit, replication count, collection length,
  and confidence interval;
- source format and row counts for each normalized table;
- a catalog of every continuous statistic grouped by name/type/source, with the
  average across replications;
- the full computed `insights` object, including resources, queues, entities,
  system throughput, bottleneck evidence, and notes;
- parser warnings.

It does not contain the original workbook, every raw spreadsheet row, or the
absolute path of the model file. Sending the full normalized workbook would be
slower and noisier without improving the answer. The compact catalog still lets
the model discuss statistics that are not singled out in `insights`, such as an
average number of busy units for a particular resource.

### The grounding rules

The instruction tells the model to:

- use only the supplied context for report-specific values and rankings;
- say when a requested value is absent instead of estimating it;
- quote exact metric names and include the time unit for time-based values;
- mention when a half-width is insufficient or correlated;
- explain general simulation concepts only from general knowledge, without
  attaching invented report numbers.

This is the main reason the chatbot is useful for a specific report. A model's
training data may contain general Arena knowledge, but it cannot know the values
in a workbook uploaded on the user's machine.

### Untrusted report data

Report text is treated as data, not instructions. An uploaded project name or
warning could contain something like "ignore previous instructions." The system
instruction explicitly tells the model to ignore instruction-like text inside
report fields. Model output is only stored as display text; it is never executed.

## 4. The Gemini request

`src/server/ai/geminiAiProvider.ts` is the only file that talks to Google.

The endpoint is:

```text
POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
```

The API key is sent in a header:

```http
x-goog-api-key: <key>
```

It is not placed in the URL query string, which reduces the chance of the key
appearing in logs or copied URLs. The key is never sent to the browser and is
never written to the database.

The request body has three main parts:

```json
{
  "systemInstruction": {
    "parts": [{ "text": "...rules and report context..." }]
  },
  "contents": [
    { "role": "user", "parts": [{ "text": "First question" }] },
    { "role": "model", "parts": [{ "text": "First answer" }] },
    { "role": "user", "parts": [{ "text": "Current question" }] }
  ],
  "generationConfig": {
    "temperature": 0.2,
    "maxOutputTokens": 4096,
    "thinkingConfig": { "thinkingLevel": "LOW" }
  }
}
```

Gemini calls assistant turns `model`, while the application stores them as
`assistant`. The provider translates between the two. Consecutive turns with the
same role are merged because a failed previous request can leave two user
messages next to each other in the stored conversation.

A low temperature is used because the goal is explanation of supplied facts,
not creative writing. Gemini 3 models think before answering, and thinking
tokens count toward `maxOutputTokens`. The provider sets `thinkingLevel` to
`LOW` and allows 4096 output tokens so routine report explanations have room to
finish without truncation.

### Timeouts and errors

Each request uses `AbortSignal.timeout(GEMINI_TIMEOUT_MS)`. The default is 30
seconds. A timeout becomes a `504` with code `AI_PROVIDER_TIMEOUT`.

Provider errors are translated into stable API errors:

| Gemini result        | API status | Code                           |
| -------------------- | ---------- | ------------------------------ |
| `400`                | `502`      | `AI_PROVIDER_REQUEST_REJECTED` |
| `401` or `403`       | `502`      | `AI_PROVIDER_AUTH_FAILED`      |
| `404`                | `502`      | `AI_PROVIDER_MODEL_NOT_FOUND`  |
| `429`                | `503`      | `AI_PROVIDER_RATE_LIMITED`     |
| `5xx`                | `502`      | `AI_PROVIDER_UNAVAILABLE`      |
| Network failure      | `502`      | `AI_PROVIDER_UNAVAILABLE`      |
| Unreadable JSON      | `502`      | `AI_PROVIDER_INVALID_RESPONSE` |
| Empty candidate      | `502`      | `AI_PROVIDER_EMPTY_RESPONSE`   |
| Safety block         | `502`      | `AI_RESPONSE_BLOCKED`          |

The raw Google error body is not returned to the client. It can contain account
or implementation details that are not useful to the person asking a question
about a simulation report.

There is intentionally no automatic retry yet. Retrying can turn a rate limit
into a longer burst, and it hides failures from the user. A single clear error
is easier to understand and debug. Retries can be added later if real usage
shows a need.

## 5. Getting an API key

1. Open <https://aistudio.google.com/apikey>.
2. Create an API key for the Google account that will own the free-tier usage.
3. Put it in `.env`:

   ```dotenv
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-key-here
   GEMINI_MODEL=gemini-3.8-flash
   GEMINI_TIMEOUT_MS=30000
   ```

4. Restart the backend.

`.env` is already ignored by git. Do not put the key in `README.md`, source
files, screenshots, or a browser request.

The default model can be changed without a code edit. The provider also accepts
a value with a `models/` prefix, such as `models/gemini-3.8-flash`.

## 6. Testing without a key

The tests never call Google. `createGeminiAiProvider` accepts an optional
`fetchImpl`, so `tests/server/geminiAiProvider.test.ts` supplies a fake function
that captures the request and returns canned responses.

That lets the tests verify:

- the endpoint and model name;
- the `x-goog-api-key` header;
- the `systemInstruction` and conversation mapping;
- history merging;
- HTTP error mapping, timeouts, network failures, safety blocks, and malformed
  responses.

`tests/server/aiPrompt.test.ts` separately checks that the prompt contains
report facts, the safety rules, compact statistics, and no local file path.

Run the checks with:

```bash
npm run typecheck
npm test
npm run build
```

## 7. Privacy and cost

- Report files and the SQLite database stay local.
- The compact prompt, recent history, and current question are sent to Google
  only when `AI_PROVIDER=gemini`.
- The workbook itself is not uploaded to Google.
- Google's current free tier may use submitted content to improve its products.
  Do not use the free tier for confidential reports if that tradeoff is
  unacceptable. A paid tier or a future local provider avoids it.
- The free tier is zero-cost only within the quota Google currently provides.
  Limits can change; check AI Studio for the current terms.
- The backend does not stream tokens and does not retry failed requests.
- Fine-tuning is not part of the first working chatbot. Supplying computed
  report facts as context is cheaper, easier to update, and keeps the model from
  memorizing one report's values.

## 8. Where to look next

- `src/server/ai/promptBuilder.ts` - report context and grounding rules.
- `src/server/ai/geminiAiProvider.ts` - Gemini REST request and response handling.
- `src/server/ai/index.ts` - provider selection.
- `src/config.ts` - environment validation.
- `src/server/services/conversationService.ts` - report/history loading and storage.
- `tests/server/geminiAiProvider.test.ts` - offline provider behavior.
