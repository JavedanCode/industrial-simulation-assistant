/* eslint-env node */
// Exercise address normalization and the saved-address override without a
// native runtime. Both decide whether requests reach the laptop at all.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

const apiDirectory = path.join(__dirname, "../src/api");

function loadApiUrl(builtInAddress) {
  const cache = {};
  function load(name) {
    if (cache[name]) return cache[name];
    const exports = {};
    const source = fs.readFileSync(path.join(apiDirectory, `${name}.ts`), "utf8");
    vm.runInNewContext(
      ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2022,
        },
      }).outputText,
      {
        exports,
        require: (id) => load(id.replace(/^\.\//, "").replace(/\.ts$/, "")),
        process: {
          env:
            builtInAddress === undefined
              ? {}
              : { EXPO_PUBLIC_API_URL: builtInAddress },
        },
        URL,
      },
    );
    cache[name] = exports;
    return exports;
  }
  return { apiUrl: load("api_url"), errors: load("errors") };
}

test("a bare LAN address is completed with http:// and /api", () => {
  const { apiUrl } = loadApiUrl();
  assert.equal(
    apiUrl.normalizeApiUrl("192.168.1.16:3000"),
    "http://192.168.1.16:3000/api",
  );
  assert.equal(
    apiUrl.normalizeApiUrl("  192.168.1.16:3000/api/  "),
    "http://192.168.1.16:3000/api",
  );
});

test("complete addresses are kept, minus a trailing slash", () => {
  const { apiUrl } = loadApiUrl();
  assert.equal(
    apiUrl.normalizeApiUrl("https://assistant.example.com/api/"),
    "https://assistant.example.com/api",
  );
  assert.equal(
    apiUrl.normalizeApiUrl("HTTP://10.0.0.4:3000/api"),
    "http://10.0.0.4:3000/api",
  );
  // A custom mount point is respected rather than rewritten to /api.
  assert.equal(
    apiUrl.normalizeApiUrl("http://10.0.0.4:3000/v2/api"),
    "http://10.0.0.4:3000/v2/api",
  );
});

test("unusable addresses are rejected with a readable message", () => {
  const { apiUrl } = loadApiUrl();
  const cases = [
    ["", /backend address in Settings/],
    [null, /backend address in Settings/],
    ["   ", /backend address in Settings/],
    ["ftp://192.168.1.16/reports", /must start with http/],
    ["http://user:secret@192.168.1.16:3000/api", /username and password/],
    ["http://192.168.1.16:3000/api?debug=1", /query string/],
    ["http://192.168.1.16:3000/api#top", /query string/],
  ];
  for (const [input, pattern] of cases) {
    assert.throws(() => apiUrl.normalizeApiUrl(input), pattern, String(input));
  }
});

test("a saved address overrides the one baked into the build", () => {
  const { apiUrl } = loadApiUrl("http://192.168.1.16:3000/api");
  assert.equal(apiUrl.getApiUrl(), "http://192.168.1.16:3000/api");
  assert.equal(apiUrl.hasApiUrlOverride(), false);

  apiUrl.setApiUrlOverride("http://192.168.1.99:3000");
  assert.equal(apiUrl.hasApiUrlOverride(), true);
  assert.equal(apiUrl.getApiUrl(), "http://192.168.1.99:3000/api");
  assert.equal(apiUrl.getApiUrlPreview(), "http://192.168.1.99:3000");

  apiUrl.setApiUrlOverride(null);
  assert.equal(apiUrl.getApiUrl(), "http://192.168.1.16:3000/api");
});

test("a build with no baked address still fails as a configuration error", () => {
  const { apiUrl, errors } = loadApiUrl(undefined);
  assert.equal(apiUrl.getApiUrlPreview(), "");
  // The transport rethrows ApiError untouched and rewrites plain errors into
  // "Couldn't reach the backend", so this must stay an ApiError.
  assert.throws(
    () => apiUrl.getApiUrl(),
    (error) =>
      error instanceof errors.ApiError &&
      /backend address in Settings/.test(error.message),
  );
});
