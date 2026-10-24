// Real SQLite/file operations through adapters; native Expo bridge needs phone testing.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { DatabaseSync } = require("node:sqlite");
const { randomUUID } = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

function loadModule(name, requireModule) {
  const source = fs.readFileSync(
    path.join(__dirname, "../src/features/reports", name + ".ts"),
    "utf8",
  );
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { exports: {}, require: requireModule };
  vm.runInNewContext(code, context);
  return context.exports;
}

test("saved text/documents survive reopen; failed insert cleans up its copy", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "report-storage-"));
  const dbPath = path.join(root, "reports.db");
  const sourcePath = path.join(root, "picked.xlsm");
  let raw = new DatabaseSync(dbPath);
  let failInsert = false;
  let failFileDelete = false;
  const management = loadModule("report_management", () => {
    throw Error("Unexpected import");
  });
  const builder = loadModule("report_submission", (name) => {
    if (name === "./report_file_types")
      return loadModule("report_file_types", () => {
        throw Error("Unexpected import");
      });
    throw Error("Unexpected import");
  });
  class File {
    constructor(...parts) {
      this.uri = path.join(...parts.map((p) => p.uri ?? p));
    }
    get exists() {
      return fs.existsSync(this.uri);
    }
    get size() {
      return fs.statSync(this.uri).size;
    }
    async copy(destination) {
      // Match Expo SDK 57: copying completes asynchronously and can reject.
      await new Promise(setImmediate);
      fs.copyFileSync(this.uri, destination.uri, fs.constants.COPYFILE_EXCL);
    }
    delete() {
      if (failFileDelete) throw Error("Simulated file deletion failure");
      fs.unlinkSync(this.uri);
    }
  }
  class Directory extends File {
    create() {
      fs.mkdirSync(this.uri, { recursive: true });
    }
  }
  function storage() {
    return loadModule("report_storage", (name) => {
      if (name === "./report_submission") return builder;
      if (name === "./report_management") return management;
      if (name === "expo-file-system")
        return { File, Directory, Paths: { document: root } };
      if (name === "expo-sqlite")
        return {
          openDatabaseAsync: async () => ({
            execAsync: async (sql) => raw.exec(sql),
            runAsync: async (sql, ...params) => {
              if (failInsert) throw Error("Simulated write failure");
              return raw.prepare(sql).run(...params);
            },
            getAllAsync: async (sql) => raw.prepare(sql).all(),
            getFirstAsync: async (sql, ...params) =>
              raw.prepare(sql).get(...params) ?? null,
            closeAsync: async () => raw.close(),
          }),
        };
      throw Error(name);
    });
  }
  try {
    let store = storage();
    assert.equal((await store.loadReports()).length, 0);
    // Seed an existing text report to verify backwards-compatible reads.
    const text = { id: randomUUID(), content: "Output 'A': 42 مرحبا" };
    raw
      .prepare(
        `INSERT INTO reports (id,title,createdAt,source,status,content)
       VALUES (?,?,?,?,?,?)`,
      )
      .run(
        text.id,
        "Legacy report",
        new Date().toISOString(),
        "text",
        "awaiting_backend",
        text.content,
      );
    await assert.rejects(
      store.saveReport(randomUUID(), {
        source: "text",
        title: "x",
        content: "Previously valid pasted text",
      }),
    );
    fs.writeFileSync(sourcePath, "document bytes, never executed");
    const input = {
      source: "document",
      document: {
        name: "example.xlsm",
        uri: sourcePath,
        mimeType: "application/vnd.ms-excel.sheet.macroEnabled.12",
      },
    };
    const doc = await store.saveReport(randomUUID(), input);
    await assert.rejects(
      store.renameReport(doc.id, "   "),
      /Enter a report name/,
    );
    await assert.rejects(store.renameReport(doc.id, "x".repeat(121)), /120/);
    assert.equal(
      await store.renameReport(doc.id, "  Today's report مرحبا  "),
      "Today's report مرحبا",
    );
    const renamed = (await store.loadReports()).find(
      (item) => item.id === doc.id,
    );
    assert.equal(renamed.title, "Today's report مرحبا");
    assert.equal(renamed.documentName, "example.xlsm");
    assert.equal(renamed.documentPath, doc.documentPath);
    // Corrupt paths must never let deletion escape the app-owned report copy.
    raw
      .prepare("UPDATE reports SET documentPath = ? WHERE id = ?")
      .run("../picked.xlsm", doc.id);
    await assert.rejects(store.deleteReport(doc.id), /path is invalid/);
    assert.equal(fs.existsSync(sourcePath), true);
    raw
      .prepare("UPDATE reports SET documentPath = ? WHERE id = ?")
      .run(doc.documentPath, doc.id);
    // A failed file deletion keeps the report available for an explicit retry.
    failFileDelete = true;
    await assert.rejects(
      store.deleteReport(doc.id),
      /Simulated file deletion failure/,
    );
    assert.equal((await store.loadReports()).length, 2);
    assert.equal(fs.existsSync(path.join(root, doc.documentPath)), true);
    failFileDelete = false;
    assert.equal(path.isAbsolute(doc.documentPath), false);
    assert.equal(
      fs.readFileSync(path.join(root, doc.documentPath), "utf8"),
      fs.readFileSync(sourcePath, "utf8"),
    );
    const failedId = randomUUID();
    failInsert = true;
    await assert.rejects(
      store.saveReport(failedId, input),
      /Simulated write failure/,
    );
    assert.equal(
      fs.existsSync(path.join(root, "reports", failedId + ".xlsm")),
      false,
    );
    assert.equal(fs.existsSync(sourcePath), true);
    failInsert = false;
    await assert.rejects(
      store.saveReport(randomUUID(), {
        source: "document",
        document: { ...input.document, uri: path.join(root, "missing.xlsm") },
      }),
    );
    assert.equal((await store.loadReports()).length, 2);
    raw.close();
    raw = new DatabaseSync(dbPath);
    store = storage();
    const saved = await store.loadReports();
    assert.equal(saved.length, 2);
    assert.equal(
      saved.find((item) => item.id === doc.id).title,
      "Today's report مرحبا",
    );
    assert.equal(
      saved.find((item) => item.id === text.id).content,
      text.content,
    );
    assert.equal(
      fs.existsSync(
        path.join(root, saved.find((item) => item.id === doc.id).documentPath),
      ),
      true,
    );
    // Only the app's copy is removed, never the user's picked original.
    // Simulate SQLite failing after the copy has already been removed.
    failInsert = true;
    await assert.rejects(store.deleteReport(doc.id), /Simulated write failure/);
    assert.equal(fs.existsSync(path.join(root, doc.documentPath)), false);
    assert.equal((await store.loadReports()).length, 2);
    failInsert = false;
    await store.deleteReport(doc.id);
    await store.deleteReport(doc.id);
    assert.equal(fs.existsSync(sourcePath), true);
    assert.equal((await store.loadReports()).length, 1);
    await store.deleteReport(text.id);
    raw.close();
    raw = new DatabaseSync(dbPath);
    store = storage();
    assert.equal((await store.loadReports()).length, 0);
  } finally {
    raw.close();
    const docs = path.join(root, "reports");
    if (fs.existsSync(docs)) {
      for (const name of fs.readdirSync(docs))
        fs.unlinkSync(path.join(docs, name));
      fs.rmdirSync(docs);
    }
    for (const name of fs.readdirSync(root))
      fs.unlinkSync(path.join(root, name));
    fs.rmdirSync(root);
  }
});

test("browser rename/delete updates only the selected session record", async () => {
  const management = loadModule("report_management", () => {
    throw Error("Unexpected import");
  });
  const builder = loadModule("report_submission", (name) => {
    if (name === "./report_file_types")
      return loadModule("report_file_types", () => {
        throw Error("Unexpected import");
      });
    throw Error("Unexpected import");
  });
  const store = loadModule("report_storage.web", (name) => {
    if (name === "./report_management") return management;
    if (name === "./report_submission") return builder;
    throw Error(name);
  });
  const input = {
    source: "document",
    document: { name: "report.xlsx", uri: "blob:demo" },
  };
  await store.saveReport("A", input);
  await store.saveReport("B", input);
  await assert.rejects(store.renameReport("A", " "));
  await store.renameReport("A", " Renamed ");
  const report = (await store.loadReports()).find((item) => item.id === "A");
  assert.equal(report.title, "Renamed");
  assert.equal(report.documentName, "report.xlsx");
  await store.deleteReport("A");
  await store.deleteReport("A");
  assert.equal(
    (await store.loadReports()).map((item) => item.id).join(","),
    "B",
  );
});
