"use strict";

const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  protocol,
  net,
  nativeTheme,
  shell,
} = require("electron");
const path = require("path");
const fs = require("fs");
const yauzl = require("yauzl");
const { pipeline } = require("node:stream/promises");

const { parseNdjson, buildModel } = require("./parsers/ndjson");
const { parseVcf } = require("./parsers/vcf");
const { normalizeNumber } = require("./phone");
const { writeXml } = require("./export-xml");

// ---- App state held in the main process (keeps IPC payloads small) ----
const state = {
  records: null, // raw parsed NDJSON records
  dataDir: null, // extracted data/ folder with PART_* attachments
  dataFiles: new Set(), // set of attachment basenames present
  model: null, // built model: { threadList, messagesByThread }
  numberToName: new Map(), // contacts: normalized number -> name
  contactsCount: 0,
  loadedFileName: "", // original backup file name (for display)
};

const storage = () => {
  const dir = path.join(app.getPath("userData"), "Recall");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
};
const CONTACTS_STORE = () => path.join(storage(), "contacts.json");
// Persistent home for the currently-loaded backup, so it survives restarts.
const LOADED_DIR = () => path.join(storage(), "loaded-backup");
const LOADED_META = () => path.join(storage(), "loaded.json");
const MIME_BY_EXT = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".bmp": "image/bmp",
  ".mp3": "audio/mpeg",
  ".amr": "audio/amr",
  ".m4a": "audio/mp4",
  ".mp4": "video/mp4",
  ".3gp": "video/3gpp",
  ".ogg": "audio/ogg",
};

// Register the custom scheme used to serve attachments to the renderer.
protocol.registerSchemesAsPrivileged([
  { scheme: "sy-media", privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
  {
    scheme: "att",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
    },
  },
]);

let mainWindow = null;

function loadStoredContacts() {
  try {
    const raw = fs.readFileSync(CONTACTS_STORE(), "utf-8");
    const obj = JSON.parse(raw);
    state.numberToName = new Map(Object.entries(obj.numberToName || {}));
    state.contactsCount = obj.count || state.numberToName.size;
  } catch {
    state.numberToName = new Map();
    state.contactsCount = 0;
  }
}

function saveStoredContacts() {
  try {
    const obj = {
      numberToName: Object.fromEntries(state.numberToName),
      count: state.contactsCount,
    };
    fs.writeFileSync(CONTACTS_STORE(), JSON.stringify(obj), "utf-8");
  } catch (e) {
    // Non-fatal — contacts just won't persist this session.
  }
}

function rebuildModel() {
  if (!state.records) return;
  state.model = buildModel(state.records, state.dataFiles, state.numberToName);
}

// Walk an extracted tree to locate the messages .ndjson file and the data/ dir.
function findBackupFiles(root) {
  let ndjsonPath = null;
  let dataDir = null;
  const stack = [root];
  while (stack.length) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        if (ent.name.toLowerCase() === "data") dataDir = full;
        stack.push(full);
      } else if (!ndjsonPath && ent.name.toLowerCase().endsWith(".ndjson")) {
        ndjsonPath = full;
      }
    }
  }
  return { ndjsonPath, dataDir };
}

// Point app state at an already-extracted backup folder and build the model.
function activateBackupDir(root) {
  let { ndjsonPath, dataDir } = findBackupFiles(root);
  if (!ndjsonPath)
    throw new Error(
      "Could not find a messages .ndjson file inside the backup.",
    );
  if (!dataDir) dataDir = path.join(path.dirname(ndjsonPath), "data");

  state.dataDir = dataDir && fs.existsSync(dataDir) ? dataDir : null;
  state.dataFiles = new Set();
  if (state.dataDir) {
    for (const f of fs.readdirSync(state.dataDir)) state.dataFiles.add(f);
  }
  state.records = parseNdjson(fs.readFileSync(ndjsonPath, "utf-8"));
  rebuildModel();
}

// Import a backup the user picked: extract/copy it into the persistent
// LOADED_DIR (replacing any previous one) so it survives app restarts.
async function ingestBackup(srcPath) {
  const dir = fs.mkdtempSync(path.join(storage(), "import-"));
  try {
    const lower = srcPath.toLowerCase();
    if (/\.(ndjson|json|txt)$/.test(lower))
      fs.copyFileSync(srcPath, path.join(dir, "messages.ndjson"));
    else await extractBackup(srcPath, dir);
    const found = findBackupFiles(dir);
    if (!found.ndjsonPath)
      throw new Error("No messages.ndjson found in this Fig backup.");
    const records = parseNdjson(fs.readFileSync(found.ndjsonPath, "utf8"));
    if (!records.length)
      throw new Error("No valid messages found in this backup.");
    buildModel(records, new Set(), state.numberToName);
    const old = LOADED_DIR() + ".previous";
    if (fs.existsSync(old)) fs.rmSync(old, { recursive: true, force: true });
    if (fs.existsSync(LOADED_DIR())) fs.renameSync(LOADED_DIR(), old);
    try {
      fs.renameSync(dir, LOADED_DIR());
    } catch (error) {
      if (fs.existsSync(old)) fs.renameSync(old, LOADED_DIR());
      throw error;
    }
    activateBackupDir(LOADED_DIR());
    if (fs.existsSync(old)) fs.rmSync(old, { recursive: true, force: true });
  } finally {
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  }

  state.loadedFileName = path.basename(srcPath);
  try {
    fs.writeFileSync(
      LOADED_META(),
      JSON.stringify({
        fileName: state.loadedFileName,
        loadedAt: Date.now(),
      }),
      "utf-8",
    );
  } catch {}
}

// On startup, re-activate a previously-loaded backup if one is saved.
function loadPersistedBackup() {
  const dir = LOADED_DIR();
  try {
    const { ndjsonPath } = findBackupFiles(dir);
    if (!ndjsonPath) return false;
    activateBackupDir(dir);
    try {
      const meta = JSON.parse(fs.readFileSync(LOADED_META(), "utf-8"));
      state.loadedFileName = meta.fileName || "";
    } catch {}
    return true;
  } catch {
    return false;
  }
}

function threadSummaries() {
  if (!state.model) return [];
  return state.model.threadList.map((t) => ({
    id: t.id,
    title: t.title,
    isGroup: t.isGroup,
    lastDate: t.lastDate,
    lastSnippet: t.lastSnippet,
    messageCount: t.messageCount,
    participants: t.participants,
  }));
}

let exporting = false;
function handle(channel, fn) {
  ipcMain.handle("recall:" + channel, async (event, ...args) => {
    if (
      !mainWindow ||
      event.sender !== mainWindow.webContents ||
      event.senderFrame !== mainWindow.webContents.mainFrame
    )
      throw new Error("Untrusted Recall request");
    if (
      exporting &&
      ["export-xml", "open-backup", "clear-all"].includes(channel)
    )
      return { error: "Wait for the current XML export to finish." };
    if (channel !== "export-xml") return fn(event, ...args);
    exporting = true;
    try {
      return await fn(event, ...args);
    } finally {
      exporting = false;
    }
  });
}
async function extractBackup(src, destination) {
  const zip = await yauzl.openPromise(src);
  let count = 0, total = 0;
  try {
    for await (const entry of zip.eachEntry()) {
      count++;
      total += entry.uncompressedSize;
      if (count > 10000 || total > 2_000_000_000 || entry.uncompressedSize > 250_000_000) throw new Error('Backup exceeds the extraction limit (10,000 files, 2 GB total, 250 MB per file).');
      const name = entry.fileName.replace(/\\/g, '/');
      if (name.startsWith('/') || name.includes(':') || name.split('/').includes('..') || ((entry.externalFileAttributes >>> 16) & 0xf000) === 0xa000) throw new Error('Unsafe backup archive path.');
      const target = path.resolve(destination, name);
      if (!target.startsWith(path.resolve(destination) + path.sep)) throw new Error('Unsafe backup archive path.');
      if (name.endsWith('/')) await fs.promises.mkdir(target, {recursive:true});
      else {
        await fs.promises.mkdir(path.dirname(target), {recursive:true});
        await pipeline(await zip.openReadStreamPromise(entry), fs.createWriteStream(target, {flags:'wx'}));
      }
    }
  } finally { zip.close(); }
}

handle("get-initial", async () => {
  if (!state.model) return { loaded:false, contacts:state.contactsCount };
  return {loaded:true, threads:threadSummaries(), stats:{threads:state.model.threadList.length,messages:state.records.length,contacts:state.contactsCount,fileName:state.loadedFileName}};
});

handle("open-backup", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Open Fig backup",
    properties: ["openFile"],
    filters: [
      { name: "Message backups", extensions: ["zip", "ndjson", "json", "txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  try {
    await ingestBackup(res.filePaths[0]);
    return {
      canceled: false,
      threads: threadSummaries(),
      stats: {
        threads: state.model.threadList.length,
        messages: state.records.length,
        contacts: state.contactsCount,
        fileName: state.loadedFileName,
      },
    };
  } catch (e) {
    return { canceled: false, error: e.message || String(e) };
  }
});

handle("import-contacts", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Import contacts (.vcf)",
    properties: ["openFile"],
    filters: [
      { name: "vCard contacts", extensions: ["vcf", "vcard"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  try {
    const text = fs.readFileSync(res.filePaths[0], "utf-8");
    const { numberToName, contacts } = parseVcf(text);
    state.numberToName = numberToName;
    state.contactsCount = contacts.length;
    saveStoredContacts();
    rebuildModel();
    return {
      canceled: false,
      count: contacts.length,
      threads: threadSummaries(),
    };
  } catch (e) {
    return { canceled: false, error: e.message || String(e) };
  }
});

handle("get-thread", async (_evt, threadId) => {
  if (!state.model) return { messages: [] };
  const msgs = state.model.messagesByThread.get(String(threadId)) || [];
  const thread = state.model.threadList.find((t) => t.id === String(threadId));
  return { thread: thread || null, messages: msgs };
});

handle("search", async (_evt, query) => {
  if (!state.model || !query || !query.trim()) return { results: [] };
  const q = query.trim().toLowerCase();
  const results = [];
  for (const thread of state.model.threadList) {
    const msgs = state.model.messagesByThread.get(thread.id) || [];
    for (const m of msgs) {
      const hay = (m.body || "").toLowerCase();
      if (hay.includes(q) || thread.title.toLowerCase().includes(q)) {
        results.push({
          threadId: thread.id,
          threadTitle: thread.title,
          messageId: m.id,
          dir: m.dir,
          ts: m.ts,
          senderName: m.sender ? m.sender.name : "",
          snippet: m.body || (m.attachments.length ? "[attachment]" : ""),
        });
        if (results.length >= 400) return { results };
      }
    }
  }
  return { results };
});

handle("clear-all", async () => {
  // Wipe everything loaded: backup, attachments, and remembered contacts.
  state.records = null;
  state.model = null;
  state.dataDir = null;
  state.dataFiles = new Set();
  state.numberToName = new Map();
  state.contactsCount = 0;
  state.loadedFileName = "";
  // Delete the persisted backup, its meta, and remembered contacts.
  try {
    fs.rmSync(LOADED_DIR(), { recursive: true, force: true });
  } catch {}
  try {
    fs.rmSync(LOADED_META(), { force: true });
  } catch {}
  try {
    fs.rmSync(CONTACTS_STORE(), { force: true });
  } catch {}
  return { ok: true };
});

// Let the renderer pick a backup file (for "export a different file") without
// loading it into the viewer.
handle("pick-backup-path", async () => {
  const res = await dialog.showOpenDialog(mainWindow, {
    title: "Choose a backup to export",
    properties: ["openFile"],
    filters: [
      { name: "Message backups", extensions: ["zip", "ndjson", "json", "txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  if (res.canceled || !res.filePaths.length) return { canceled: true };
  return { path: res.filePaths[0] };
});

// Prepare records + attachment dir for export, from the loaded backup or a file.
async function prepareExportSource(mode, srcPath) {
  if (mode === "current") {
    if (!state.records)
      return {
        error:
          "No backup is loaded to export. Open one first, or choose a different file.",
      };
    return {
      records: state.records,
      dataDir: state.dataDir,
      dataFiles: state.dataFiles,
      name: state.loadedFileName,
      temp: null,
    };
  }
  if (!srcPath || !fs.existsSync(srcPath))
    return { error: "That file could not be found." };
  const lower = srcPath.toLowerCase();
  if (
    lower.endsWith(".ndjson") ||
    lower.endsWith(".json") ||
    lower.endsWith(".txt")
  ) {
    const records = parseNdjson(fs.readFileSync(srcPath, "utf-8"));
    return {
      records,
      dataDir: null,
      dataFiles: new Set(),
      name: path.basename(srcPath),
      temp: null,
    };
  }
  const tempDir = fs.mkdtempSync(path.join(app.getPath("temp"), "recall-exp-"));
  try {
    await extractBackup(srcPath, tempDir);
  } catch (e) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    return { error: "Could not read that backup file." };
  }
  const found = findBackupFiles(tempDir);
  if (!found.ndjsonPath) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch {}
    return { error: "No messages .ndjson file was found in that backup." };
  }
  const records = parseNdjson(fs.readFileSync(found.ndjsonPath, "utf-8"));
  let dataDir =
    found.dataDir && fs.existsSync(found.dataDir) ? found.dataDir : null;
  const dataFiles = new Set();
  if (dataDir) for (const f of fs.readdirSync(dataDir)) dataFiles.add(f);
  return {
    records,
    dataDir,
    dataFiles,
    name: path.basename(srcPath),
    temp: tempDir,
  };
}

handle("export-xml", async (_evt, opts) => {
  const { mode, srcPath } = opts || {};
  let src;
  try {
    src = await prepareExportSource(mode, srcPath);
  } catch (e) {
    return { error: e.message };
  }
  if (src.error) return { error: src.error };
  const cleanup = () => {
    if (src.temp) {
      try {
        fs.rmSync(src.temp, { recursive: true, force: true });
      } catch {}
    }
  };

  const base = (src.name || "messages").replace(
    /\.(zip|ndjson|json|txt)$/i,
    "",
  );
  const save = await dialog.showSaveDialog(mainWindow, {
    title: "Export XML",
    defaultPath: `sms-${base}.xml`,
    filters: [{ name: "XML backup", extensions: ["xml"] }],
  });
  if (save.canceled || !save.filePath) {
    cleanup();
    return { canceled: true };
  }

  const pending = save.filePath + "." + require("crypto").randomUUID() + ".tmp";
  try {
    const res = await writeXml(
      src.records,
      src.dataDir,
      src.dataFiles,
      pending,
      (done, total, embedded) => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("export-progress", {
            done,
            total,
            embedded,
          });
        }
      },
      state.numberToName,
    );
    fs.renameSync(pending, save.filePath);
    cleanup();
    return {
      ok: true,
      outPath: save.filePath,
      count: res.count,
      embedded: res.embedded,
    };
  } catch (e) {
    try {
      fs.rmSync(pending, { force: true });
    } catch {}
    cleanup();
    return { error: e.message || String(e) };
  }
});

handle("get-theme", async () => ({ dark: nativeTheme.shouldUseDarkColors }));
handle("app-info", async () => ({ contacts: state.contactsCount }));

// Serve attachment files via att://<basename>
function registerAttachmentProtocol() {
  protocol.handle("att", async (request) => {
    try {
      const url = new URL(request.url);
      // att://file/<basename> — host part is ignored, path holds the name.
      const base = decodeURIComponent(
        (url.hostname + url.pathname).replace(/^\/+/, "").replace(/\/+$/, ""),
      );
      const name = base.split("/").pop();
      if (!state.dataDir || !name || !state.dataFiles.has(name)) {
        return new Response("Not found", { status: 404 });
      }
      const full = path.join(state.dataDir, name);
      const ext = path.extname(name).toLowerCase();
      const buf = fs.readFileSync(full);
      const mime = MIME_BY_EXT[ext] || "application/octet-stream";
      return new Response(buf, {
        status: 200,
        headers: { "Content-Type": mime },
      });
    } catch (e) {
      return new Response("Error", { status: 500 });
    }
  });
}

app.whenReady().then(registerAttachmentProtocol);
let initialized = false;
module.exports.openRecall = async (window) => {
  mainWindow = window;
  if (!initialized) {
    loadStoredContacts();
    loadPersistedBackup();
    initialized = true;
  }
};
