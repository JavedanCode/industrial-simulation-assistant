/* eslint-env node */
// Exercise data preservation at the formatting boundary without a native renderer.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const source = fs.readFileSync(
  path.join(__dirname, "../src/features/reports/chat/analysis_format.ts"),
  "utf8",
);
const sandbox = { exports: {} };
vm.runInNewContext(
  ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText,
  sandbox,
);
const parse = (text) =>
  JSON.parse(JSON.stringify(sandbox.exports.parseAnalysis(text)));

test("headings, lists and ordinary text preserve their content", () => {
  assert.deepEqual(
    parse(
      "## Findings\r\n\r\n- **Busy**\r\n2. Review\r\n<script>not executable</script>",
    ),
    [
      { type: "heading", text: "Findings" },
      { type: "list", marker: "•", text: "**Busy**" },
      { type: "list", marker: "2.", text: "Review" },
      { type: "text", text: "<script>not executable</script>" },
    ],
  );
});
test("tables preserve empty cells, escaped pipes and zero values", () => {
  assert.deepEqual(
    parse("| Name | Value |\n| :--- | ---: |\n| A\\|B | 0 |\n| Empty | |"),
    [
      {
        type: "table",
        headers: ["Name", "Value"],
        rows: [
          ["A|B", "0"],
          ["Empty", ""],
        ],
      },
    ],
  );
});
test("malformed table rows are retained rather than truncated", () => {
  const result = parse("A | B\n--- | ---\n1 | 2 | 3\na | b");
  assert.equal(result[1].text, "1 | 2 | 3");
  assert.equal(result[2].text, "a | b");
  assert.equal(parse("A | B\nnot a separator")[0].type, "text");
});
test("fenced code bypasses formatting; unfinished fences lose no text", () => {
  assert.deepEqual(parse("```txt\n# literal\n| x | y |\n```"), [
    { type: "code", text: "# literal\n| x | y |" },
  ]);
  assert.equal(parse("```txt\nunfinished")[0].text, "```txt\nunfinished");
  assert.deepEqual(parse("\n  \n"), []);
});
