const { openRecall } = require('./recall/main/main.js');
const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  shell,
  clipboard,
  session,
} = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");
if (process.env.SWITCHYARD_TEST_DATA)
  app.setPath("userData", process.env.SWITCHYARD_TEST_DATA);
let win, processTool, command, toolById;
let jobs = [],
  running = false;
const controls = new Map(),
  allowed = new Set();
let settings = { theme: "light", favorites: [], engines: {} };
const data = () => app.getPath("userData");
const state = () => ({
  jobs,
  settings,
  outputRoot: path.join(data(), "Outputs"),
});
function publish() {
  if (win && !win.isDestroyed()) win.webContents.send("state:update", state());
}
let writes = Promise.resolve();
function persist() {
  const snapshot = JSON.stringify(
    {
      settings,
      jobs: jobs
        .filter((j) =>
          ["done", "partial", "error", "cancelled"].includes(j.status),
        )
        .slice(0, 100),
    },
    null,
    2,
  );
  writes = writes
    .catch(() => {})
    .then(async () => {
      await fs.mkdir(data(), { recursive: true });
      const temp = path.join(data(), "state.tmp");
      await fs.writeFile(temp, snapshot);
      await fs.rename(temp, path.join(data(), "state.json"));
    });
  return writes;
}
async function addFiles(paths) {
  if (!Array.isArray(paths) || paths.length > 100)
    throw new Error("Choose up to 100 files.");
  const result = [];
  for (const p of paths) {
    if (typeof p !== "string" || !path.isAbsolute(p))
      throw new Error("Expected an absolute file path.");
    const real = await fs.realpath(p);
    const stat = await fs.stat(real);
    if (!stat.isFile()) continue;
    allowed.add(real);
    result.push({ path: real, name: path.basename(real), size: stat.size });
  }
  return result;
}
async function pump() {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const job = jobs.findLast((j) => j.status === "queued");
      if (!job) break;
      const controller = new AbortController();
      controls.set(job.id, controller);
      job.status = "running";
      job.startedAt = Date.now();
      publish();
      try {
        const result = await processTool(job.request, {
          outputDir: job.folder,
          engines: settings.engines,
          signal: controller.signal,
          onLog: (line) => {
            job.log = (job.log + line).slice(-6000);
            publish();
          },
        });
        job.outputs = result.outputs;
        for (const p of result.outputs) allowed.add(p);
        job.text = result.text;
        job.status = result.failures ? "partial" : "done";
      } catch (error) {
        job.error = error.message;
        job.status = controller.signal.aborted ? "cancelled" : "error";
      } finally {
        job.finishedAt = Date.now();
        delete job.request;
        controls.delete(job.id);
        publish();
        await persist().catch((error) => {
          job.log += "\nCould not save history: " + error.message;
          publish();
        });
      }
    }
  } finally {
    running = false;
  }
}
app.whenReady().then(async () => {
  ({ processTool, command } = await import("./processor.mjs"));
  ({ toolById } = await import("../shared/catalog.mjs"));
  try {
    const saved = JSON.parse(
      await fs.readFile(path.join(data(), "state.json"), "utf8"),
    );
    settings = {
      ...settings,
      ...saved.settings,
      engines: { ...saved.settings?.engines },
    };
    jobs = Array.isArray(saved.jobs) ? saved.jobs.slice(0, 100) : [];
    for (const j of jobs) for (const p of j.outputs || []) allowed.add(p);
  } catch {}
  const engineRoot = app.isPackaged
    ? path.join(process.resourcesPath, "engines")
    : path.join(__dirname, "../engines");
  for (const [key, relative] of Object.entries({
    ffmpeg: "ffmpeg/ffmpeg.exe",
    ffprobe: "ffmpeg/ffprobe.exe",
    ytdlp: "yt-dlp.exe",
    whisper: "whisper/whisper-cli.exe",
    whisperModel: "ggml-tiny.en.bin",
    separator: "separator/python.exe",
    pandoc: "pandoc/pandoc.exe",
    office: "office/program/soffice.com",
    sevenz: "7zip/7z.exe",
  })) {
    if (!settings.engines[key]) {
      const candidate = path.join(engineRoot, relative);
      try {
        await fs.access(candidate);
        settings.engines[key] = candidate;
      } catch {}
    }
  }
  settings.engines.separatorModels = path.join(engineRoot, "models");
  settings.engines.ocrModels = path.join(engineRoot, "ocr");
  if (!settings.engines.whisper) {
    const candidate = path.join(engineRoot, "whisper/Release/whisper-cli.exe");
    try {
      await fs.access(candidate);
      settings.engines.whisper = candidate;
    } catch {}
  }
  session.defaultSession.setPermissionRequestHandler(
    (wc, permission, callback) =>
      callback(wc === win?.webContents && permission === "media"),
  );
  win = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 900,
    minHeight: 650,
    title: "Switchyard",
    backgroundColor: "#f6f4ef",
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (e) => e.preventDefault());
  function handle(channel, fn) {
    ipcMain.handle(channel, (event, ...args) => {
      if (
        event.sender !== win.webContents ||
        event.senderFrame !== win.webContents.mainFrame
      )
        throw new Error("Untrusted caller");
      return fn(...args);
    });
  }
  handle("state:get", () => state());
  handle("files:pick", async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile", "multiSelections"],
    });
    return result.canceled ? [] : addFiles(result.filePaths);
  });
  handle("files:add", addFiles);
  handle("files:preview", async (p) => {
    if (!allowed.has(p)) throw new Error("Choose this file first.");
    const sharp = (await import("sharp")).default;
    const meta = await sharp(p).metadata();
    const swapped = [5, 6, 7, 8].includes(meta.orientation);
    const buffer = await sharp(p)
      .rotate()
      .resize({
        width: 1000,
        height: 700,
        fit: "inside",
        withoutEnlargement: true,
      })
      .png()
      .toBuffer();
    return {
      url: "data:image/png;base64," + buffer.toString("base64"),
      width: swapped ? meta.height : meta.width,
      height: swapped ? meta.width : meta.height,
    };
  });
  handle("text:copy", (text) => {
    if (typeof text !== "string") throw new Error("Expected text");
    clipboard.writeText(text);
  });
  handle("jobs:run", async (request) => {
    if (!request || !toolById[request.toolId]) throw new Error("Unknown tool.");
    if (
      !Array.isArray(request.files) ||
      request.files.some((p) => !allowed.has(p))
    )
      throw new Error("Add your files to the tray first.");
    if (
      jobs.filter((j) => ["queued", "running"].includes(j.status)).length >= 50
    )
      throw new Error("The queue is full.");
    const id = crypto.randomUUID();
    const job = {
      id,
      toolId: request.toolId,
      name: toolById[request.toolId].name,
      status: "queued",
      createdAt: Date.now(),
      folder: path.join(data(), "Outputs", id),
      outputs: [],
      log: "",
      request,
    };
    jobs.unshift(job);
    publish();
    void pump();
    return id;
  });
  handle("jobs:cancel", (id) => {
    const job = jobs.find((j) => j.id === id);
    if (job?.status === "queued") {
      job.status = "cancelled";
      delete job.request;
      publish();
      void persist();
    }
    controls.get(id)?.abort();
  });
  handle("output:reveal", (p) => {
    if (!allowed.has(p)) throw new Error("Unknown output.");
    shell.showItemInFolder(p);
  });
  handle("output:export", async (p) => {
    if (!allowed.has(p)) throw new Error("Unknown output.");
    const choice = await dialog.showSaveDialog(win, {
      defaultPath: path.join(app.getPath("downloads"), path.basename(p)),
    });
    if (!choice.canceled && choice.filePath) {
      await fs.copyFile(p, choice.filePath);
      return choice.filePath;
    }
    return null;
  });
  handle("recall:open", () => openRecall(win));
  handle("voice:launch", async () => {
    const exe = app.isPackaged
      ? path.join(process.resourcesPath, "voice", "SwitchyardVoice.exe")
      : path.join(__dirname, "../voice/publish/SwitchyardVoice.exe");
    await fs.access(exe);
    const child = spawn(exe, [], {
      windowsHide: false,
      detached: true,
      stdio: "ignore",
      env: { ...process.env, SWITCHYARD_ENGINES: engineRoot, ...(process.env.SWITCHYARD_TEST_DATA ? {SWITCHYARD_VOICE_TEST_DATA:path.join(data(),"Voice")} : {}) },
    });
    child.unref();
    return true;
  });
  handle("settings:save", async (patch) => {
    if (patch.theme === "light" || patch.theme === "dark")
      settings.theme = patch.theme;
    if (Array.isArray(patch.favorites))
      settings.favorites = patch.favorites.filter((id) => toolById[id]);
    publish();
    await persist();
    return settings;
  });
  handle("engines:choose", async (key) => {
    if (
      ![
        "ffmpeg",
        "ffprobe",
        "ytdlp",
        "whisper",
        "whisperModel",
        "separator",
        'office','pandoc','sevenz',
      ].includes(key)
    )
      throw new Error("Unknown engine");
    const result = await dialog.showOpenDialog(win, {
      properties: ["openFile"],
      title: "Choose " + key,
    });
    if (!result.canceled) {
      settings.engines[key] = result.filePaths[0];
      await persist();
      publish();
    }
    return settings.engines;
  });
  handle("engines:status", async () => {
    const status = {};
    for (const [key, fallback, args] of [
      ["ffmpeg", "ffmpeg", ["-version"]],
      ["ffprobe", "ffprobe", ["-version"]],
      ["ytdlp", "yt-dlp", ["--version"]],
      ["whisper", null, ["--help"]],
      ["separator", null, ["--version"]],
      ['pandoc',null,['--version']],
      ['sevenz',null,['i']],
    ]) {
      const exe = settings.engines[key] || fallback;
      if (!exe) {
        status[key] = { ready: false, detail: "Not configured" };
        continue;
      }
      try {
        const actualArgs =
          key === "separator" &&
          path.basename(exe).toLowerCase() === "python.exe"
            ? [path.join(path.dirname(exe), "../separator-runner.py"), ...args]
            : args;
        const output = await command(exe, actualArgs, { timeout: 10000 });
        status[key] = {
          ready: true,
          detail: output.split(/\r?\n/)[0] || "Available",
        };
      } catch (e) {
        status[key] = { ready: false, detail: e.message };
      }
    }
    status.whisperModel = { ready: false, detail: "Not configured" };
    for(const key of ['office']){try{await fs.access(settings.engines[key]);status[key]={ready:true,detail:'Bundled conversion engine available'};}catch{status[key]={ready:false,detail:'Not configured'};}}
    if (settings.engines.whisperModel)
      try {
        const s = await fs.stat(settings.engines.whisperModel);
        status.whisperModel = {
          ready: s.isFile(),
          detail: `${Math.round(s.size / 1024 / 1024)} MB model`,
        };
      } catch {}
    return status;
  });
  handle("voice:record", async (bytes) => {
    if (!(bytes instanceof Uint8Array) || bytes.length > 30_000_000)
      throw new Error("Recording too large.");
    const p = path.join(data(), "Recordings", crypto.randomUUID() + ".webm");
    await fs.mkdir(path.dirname(p), { recursive: true });
    await fs.writeFile(p, bytes);
    return addFiles([p]);
  });
  if (process.env.SWITCHYARD_DEV_URL)
    await win.loadURL(process.env.SWITCHYARD_DEV_URL);
  else await win.loadFile(path.join(__dirname, "../dist/index.html"));
});
app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  for (const controller of controls.values()) controller.abort();
});
