const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function load(relativePath, imports = {}, globals = {}) {
  const exports = {};
  const source = fs.readFileSync(
    path.join(__dirname, "..", relativePath),
    "utf8",
  );
  vm.runInNewContext(
    ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    {
      exports,
      require: (name) => {
        if (!(name in imports)) throw Error(name);
        return imports[name];
      },
      Blob,
      TextEncoder,
      Uint8Array,
      ...globals,
    },
  );
  return exports;
}

test("native upload uses SDK 58's actual multipart serializer with original name and bytes", async () => {
  class RNFormData {
    constructor() {
      this._parts = [];
    }
  }
  const { installFormDataPatch } = load(
    "node_modules/expo/src/winter/FormData.ts",
  );
  const FormData = installFormDataPatch(RNFormData);
  const { convertFormDataAsync } = load(
    "node_modules/expo/src/winter/fetch/convertFormData.ts",
    {
      "../../utils/blobUtils": {
        blobToArrayBufferAsync: (blob) => blob.arrayBuffer(),
      },
    },
  );
  class File {
    constructor(...parts) {
      this.uri = parts.join("/");
    }
    get exists() {
      return true;
    }
    get name() {
      return "saved-id.xlsm";
    }
    get type() {
      return "application/vnd.ms-excel.sheet.macroEnabled.12";
    }
    async bytes() {
      return new Uint8Array([80, 75, 3, 4]);
    }
  }
  const { uploadBody } = load(
    "src/features/reports/upload_body.ts",
    { "expo-file-system": { File, Paths: { document: "file:///documents" } } },
    { FormData },
  );
  const body = await uploadBody({
    documentPath: "reports/saved-id.xlsm",
    documentName: "Arena report.xlsm",
  });
  const encoded = await convertFormDataAsync(body, "test-boundary");
  const multipart = new TextDecoder().decode(encoded.body);
  assert.match(multipart, /name="report"; filename="Arena%20report.xlsm"/);
  assert.match(multipart, /PK\u0003\u0004/);
  const oldBody = new FormData();
  oldBody.append("report", {
    uri: "file:///documents/report.xlsm",
    name: "report.xlsm",
  });
  await assert.rejects(
    convertFormDataAsync(oldBody),
    /Unsupported FormDataPart/,
  );
});

test("Android picker allows mislabeled xlsm files but rejects unsupported extensions", async () => {
  let selectedName = "REPORT.XLSM";
  const types = load("src/features/reports/report_file_types.ts");
  const { pickDoc } = load("src/features/reports/pick_document.ts", {
    "react-native": { Platform: { OS: "android" } },
    "./report_file_types": types,
    "expo-document-picker": {
      getDocumentAsync: async (options) => {
        assert.equal(options.type, "*/*");
        return {
          canceled: false,
          assets: [
            {
              name: selectedName,
              uri: "content://report",
              mimeType: "application/octet-stream",
            },
          ],
        };
      },
    },
  });
  assert.equal((await pickDoc()).name, "REPORT.XLSM");
  selectedName = "photo.png";
  await assert.rejects(pickDoc(), /Please select an Arena Excel report/);
  selectedName = "old.xls";
  await assert.rejects(pickDoc(), /Convert older/);
});
