import React, { useState, useEffect, useRef } from "react";
import { createRoot } from "react-dom/client";
import {
  ChatCircleText,
  SquaresFour,
  Image,
  Waveform,
  FilmStrip,
  FilePdf,
  Code,
  DownloadSimple,
  Microphone,
  Star,
  MagnifyingGlass,
  Plus,
  ArrowRight,
  Play,
  Stop,
  X,
  FolderOpen,
  Check,
  CircleNotch,
  SlidersHorizontal,
  Moon,
  Sun,
  Command,
  ClockCounterClockwise,
  ArrowUpRight,
  PaperPlaneTilt,
  Stack,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  tools,
  categories,
  toolById,
  defaults,
  searchTools,
} from "../shared/catalog.mjs";
import "./style.css";
import CropPreview from "./CropPreview.jsx";
import MessagesView from "./MessagesView.jsx";
import BatchConverter from "./BatchConverter.jsx";
import ImageComparison from "./ImageComparison.jsx";
import { MediaResults } from './MediaTimeline.jsx';
import { PdfResults } from './DocumentPreview.jsx';
import VisualWorkspace from './VisualWorkspace.jsx';
import ImageResults from './ImageResults.jsx';
const api = window.switchyard;
const icons = {
  Images: Image,
  Audio: Waveform,
  Video: FilmStrip,
  Documents: FilePdf,
  "Text & code": Code,
  Downloads: DownloadSimple,
  "Voice & AI": Microphone,
  Everyday: Command,
};
const bytes = (n) =>
  n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`;
function App() {
  const [state, setState] = useState({
    jobs: [],
    settings: { theme: "light", favorites: [], engines: {} },
  });
  const [view, setView] = useState("All tools"),
    [query, setQuery] = useState(""),
    [selected, setSelected] = useState(null),
    [files, setFiles] = useState([]),
    [input, setInput] = useState(""),
    [options, setOptions] = useState({}),
    [error, setError] = useState(""),
    [preview, setPreview] = useState(""),
    [status, setStatus] = useState({}),
    [message, setMessage] = useState(""),
    [chat, setChat] = useState([]),
    [recording, setRecording] = useState(false);
  const recorder = useRef(null),
    stream = useRef(null),
    recordTimer = useRef(null),
    search = useRef(null);
  const favorites = state.settings.favorites || [];
  const active = state.jobs.filter((j) =>
    ["queued", "running"].includes(j.status),
  );
  useEffect(() => {
    if (!api) {
      setError(
        "Open Switchyard using its desktop launcher to enable local processing.",
      );
      return;
    }
    api
      .state()
      .then(setState)
      .catch((e) => setError(e.message));
    return api.onUpdate(setState);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = state.settings.theme;
  }, [state.settings.theme]);
  useEffect(() => {
    const fn = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        search.current?.focus();
      }
      if (e.key === "Escape") {
        setSelected(null);
        setError("");
      }
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  useEffect(
    () => () => {
      clearTimeout(recordTimer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );
  async function attempt(fn) {
    try {
      setError("");
      return await fn();
    } catch (e) {
      setError(e.message);
    }
  }
  function choose(t) {
    if (t.id === "batch-convert") {
      setView("Batch converter");
      return;
    }
    setSelected(t);
    setOptions(defaults(t));
    setPreview("");
    setError("");
  }
  useEffect(() => {
    let current = true;
    if (selected?.kind === "image" && files[0])
      api
        ?.preview(files[0].path)
        .then((value) => {
          if (current) {
            setPreview(value);
            if (selected.id === "image-crop")
              setOptions((previous) => ({
                ...previous,
                left: 0,
                top: 0,
                width: Math.min(previous.width, value.width),
                height: Math.min(previous.height, value.height),
              }));
          }
        })
        .catch(() => {
          if (current) setPreview("");
        });
    return () => {
      current = false;
    };
  }, [selected, files]);
  function mergeFiles(next) {
    setFiles((prev) => [
      ...prev,
      ...next.filter((n) => !prev.some((p) => p.path === n.path)),
    ]);
  }
  async function pick() {
    await attempt(async () => mergeFiles(await api.pick()));
  }
  async function drop(e) {
    e.preventDefault();
    await attempt(async () => {
      const paths = [...e.dataTransfer.files].map((f) => api.pathForFile(f));
      mergeFiles(await api.addPaths(paths));
    });
  }
  async function run() {
    await attempt(async () => {
      await api.run({
        toolId: selected.id,
        files: files.map((f) => f.path),
        text: input,
        options,
      });
      setView("Queue");
      setSelected(null);
    });
  }
  function favorite(id) {
    attempt(() =>
      api.saveSettings({
        favorites: favorites.includes(id)
          ? favorites.filter((x) => x !== id)
          : [...favorites, id],
      }),
    );
  }
  async function engines() {
    setView("Engines");
    setStatus({});
    await attempt(async () => setStatus(await api.engineStatus()));
  }
  function send() {
    if (!message.trim()) return;
    const matches = searchTools(message).slice(0, 4);
    setChat((prev) => [...prev, { query: message, matches }]);
    setMessage("");
  }
  async function record() {
    await attempt(async () => {
      if (recording) {
        recorder.current?.stop();
        return;
      }
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const chunks = [];
      const r = new MediaRecorder(stream.current);
      recorder.current = r;
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.push(e.data);
      };
      r.onstop = async () => {
        clearTimeout(recordTimer.current);
        stream.current?.getTracks().forEach((t) => t.stop());
        setRecording(false);
        await attempt(async () => {
          const blob = new Blob(chunks, { type: r.mimeType });
          const next = await api.record(
            new Uint8Array(await blob.arrayBuffer()),
          );
          mergeFiles(next);
          choose(toolById["voice-transcribe"]);
        });
      };
      r.start();
      setRecording(true);
      recordTimer.current = setTimeout(
        () => r.state === "recording" && r.stop(),
        120000,
      );
    });
  }
  useEffect(() => {
    if (!selected) return;
    const previous = document.activeElement;
    const trap = (e) => {
      if (e.key !== "Tab") return;
      const items = [
        ...document.querySelectorAll(
          ".tool-dialog button:not(:disabled),.tool-dialog input,.tool-dialog textarea,.tool-dialog select",
        ),
      ];
      const first = items[0],
        last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.removeEventListener("keydown", trap);
      previous?.focus?.();
    };
  }, [selected]);
  const visible = searchTools(query).filter((t) =>
    view === "Favorites"
      ? favorites.includes(t.id)
      : categories.includes(view)
        ? t.category === view
        : true,
  );
  return (
    <div className="app" onDragOver={(e) => e.preventDefault()} onDrop={drop}>
      <aside className="rail">
        <button
          className="brand"
          onClick={() => setView("All tools")}
          aria-label="Switchyard home"
        >
          <span className="brandmark">
            <Stack size={25} weight="bold" />
          </span>
          <span>
            switchyard<small>YOUR EVERYDAY WORKSHOP</small>
          </span>
        </button>
        <button className="add-button" onClick={pick}>
          <Plus size={22} /> Add files
        </button>
        <nav aria-label="Tool categories">
          <button
            className={view === "Messages" ? "nav-item selected" : "nav-item"}
            onClick={() => setView("Messages")}
          >
            <ChatCircleText size={21} />
            <span>Messages</span>
          </button>
          {[
            ["All tools", SquaresFour],
            ["Favorites", Star],
            ["Batch converter", Stack],
            ...categories.map((c) => [c, icons[c]]),
          ].map(([name, Icon]) => (
            <button
              key={name}
              className={view === name ? "nav-item selected" : "nav-item"}
              onClick={() => setView(name)}
            >
              <Icon size={21} weight={view === name ? "fill" : "regular"} />
              <span>{name}</span>
              <small>
                {name === "All tools"
                  ? tools.length
                  : name === "Favorites"
                    ? favorites.length
                    : tools.filter((t) => t.category === name).length}
              </small>
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button
            className={"nav-item " + (view === "Queue" ? "selected" : "")}
            onClick={() => setView("Queue")}
          >
            <ClockCounterClockwise size={21} /> Queue & history{" "}
            <small>{active.length || ""}</small>
          </button>
          <button
            className={"nav-item " + (view === "Engines" ? "selected" : "")}
            onClick={engines}
          >
            <SlidersHorizontal size={21} /> Engines
          </button>
          <div className="local-label">
            <span /> Files processed on this PC
          </div>
        </div>
      </aside>
      <main>
        <header>
          <label className="search">
            <MagnifyingGlass size={21} />
            <input
              ref={search}
              aria-label="Search tools"
              placeholder="Find a tool. Make something happen."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                if (["Queue", "Engines", "Command"].includes(view))
                  setView("All tools");
              }}
            />
            <kbd>Ctrl K</kbd>
          </label>
          <button
            className="icon-button"
            aria-label="Toggle theme"
            onClick={() =>
              attempt(() =>
                api.saveSettings({
                  theme: state.settings.theme === "dark" ? "light" : "dark",
                }),
              )
            }
          >
            {state.settings.theme === "dark" ? (
              <Sun size={22} />
            ) : (
              <Moon size={22} />
            )}
          </button>
          <button
            className={"command-button " + (view === "Command" ? "active" : "")}
            onClick={() => setView("Command")}
          >
            <Command size={20} /> Ask Switchyard
          </button>
        </header>
        {error && (
          <div role="alert" className="error">
            <WarningCircle size={21} />
            <span>{error}</span>
            <button aria-label="Dismiss error" onClick={() => setError("")}>
              <X />
            </button>
          </div>
        )}
        <div className="content">
          {view === "Messages" ? (
            <MessagesView api={api.messages} />
          ) : view === "Batch converter" ? (
            <BatchConverter
              files={files}
              onAdd={pick}
              onRun={async (targets) => {
                await api.run({
                  toolId: "batch-convert",
                  files: files.map((f) => f.path),
                  options: { targets },
                  text: "",
                });
                setView("Queue");
              }}
            />
          ) : view === "Queue" ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">EVERY RESULT HAS A HOME</p>
                  <h1>Queue & history</h1>
                  <p>
                    Original files stay untouched. Each job gets its own output
                    folder.
                  </p>
                </div>
                <span className="count-pill">{active.length} active</span>
              </div>
              {!state.jobs.length ? (
                <Empty
                  icon={ClockCounterClockwise}
                  title="Ready when you are"
                  text="Run a tool and its progress, results, and output files will appear here."
                />
              ) : (
                <div className="jobs">
                  {state.jobs.map((j) => (
                    <article className="job" key={j.id}>
                      <div className="job-top">
                        <span className={"job-icon " + j.status}>
                          {j.status === "done" ? (
                            <Check />
                          ) : j.status === "running" ? (
                            <CircleNotch className="spin" />
                          ) : j.status === "error" ? (
                            <WarningCircle />
                          ) : (
                            <ClockCounterClockwise />
                          )}
                        </span>
                        <div>
                          <h3>{j.name}</h3>
                          <p>
                            {new Date(j.createdAt).toLocaleString()} ·{" "}
                            {j.status}
                          </p>
                        </div>
                        {["queued", "running"].includes(j.status) && (
                          <button
                            className="secondary"
                            onClick={() => attempt(() => api.cancel(j.id))}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                      {j.error && <p className="job-error">{j.error}</p>}
                      {j.startedAt && j.finishedAt && <p className="job-duration">Processing time: {((j.finishedAt-j.startedAt)/1000).toFixed(2)} seconds</p>}
                      {j.status === 'done' && <ImageComparison job={j} api={api} />}
                      {j.status === 'done' && <MediaResults job={j} api={api} />}
                      {j.status === 'done' && <PdfResults job={j} api={api} />}
                      {j.status === 'done' && <ImageResults job={j} api={api} />}
                      {j.text !== undefined && (
                        <div className="text-result">
                          <pre>{j.text.slice(0, 10000)}</pre>
                          <button
                            className="secondary"
                            onClick={() => attempt(() => api.copy(j.text))}
                          >
                            Copy result
                          </button>
                        </div>
                      )}
                      <div className="outputs">
                        {j.outputs?.map((p) => (
                          <button
                            key={p}
                            onClick={() => attempt(() => api.reveal(p))}
                          >
                            <FolderOpen size={17} />
                            {p.split(/[\\/]/).pop()}
                            <ArrowUpRight size={16} />
                          </button>
                        ))}
                      </div>
                      {j.outputs?.length > 0 && (
                        <div className="result-actions">
                          <button
                            className="secondary"
                            onClick={() =>
                              attempt(async () =>
                                mergeFiles(await api.addPaths(j.outputs)),
                              )
                            }
                          >
                            Use results in another tool
                          </button>
                          <button
                            className="secondary"
                            onClick={() =>
                              attempt(() => api.exportFile(j.outputs[0]))
                            }
                          >
                            Save first output as
                          </button>
                        </div>
                      )}
                      {j.log && (
                        <details>
                          <summary>Processing log</summary>
                          <pre>{j.log}</pre>
                        </details>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </>
          ) : view === "Engines" ? (
            <>
              <div className="section-heading">
                <div>
                  <p className="eyebrow">LOCAL POWER, ON YOUR TERMS</p>
                  <h1>Processing engines</h1>
                  <p>
                    Image, PDF, and text tools are built in. Configure optional
                    engines here.
                  </p>
                </div>
                <button className="secondary" onClick={engines}>
                  Refresh status
                </button>
              </div>
              <div className="engine-list">
                {[
                  [
                    "ffmpeg",
                    "FFmpeg",
                    "Audio and video conversion, filtering, and exports.",
                  ],
                  [
                    "ffprobe",
                    "FFprobe",
                    "Media inspection and stream information.",
                  ],
                  [
                    "ytdlp",
                    "yt-dlp",
                    "Public video downloads. Requires an internet connection.",
                  ],
                  [
                    "whisper",
                    "Whisper CLI",
                    "Local CPU transcription with whisper.cpp. Choose whisper-cli.exe.",
                  ],
                  [
                    "whisperModel",
                    "Whisper model",
                    "Choose a ggml tiny.en or base.en model. Smaller models use less memory.",
                  ],
                  [
                    "separator",
                    "UVR separator",
                    "Bundled local Python engine and UVR model. CPU processing.",
                  ],
                  [
                    "pandoc",
                    "Pandoc",
                    "Publishing, text, and ebook conversions.",
                  ],
                  [
                    "office",
                    "LibreOffice",
                    "Document, spreadsheet, and presentation conversions.",
                  ],
                  ["sevenz", "7-Zip", "Archive inspection and conversion."],
                ].map(([key, title, desc]) => (
                  <article className="engine" key={key}>
                    <span
                      className={
                        "status-dot " + (status[key]?.ready ? "ready" : "")
                      }
                    />
                    <div>
                      <h3>{title}</h3>
                      <p>{desc}</p>
                      <small>
                        {status[key]?.detail || "Checking availability…"}
                      </small>
                      <code>
                        {state.settings.engines?.[key] ||
                          "System PATH / not configured"}
                      </code>
                    </div>
                    <button
                      className="secondary"
                      onClick={() =>
                        attempt(async () => {
                          await api.chooseEngine(key);
                          setStatus(await api.engineStatus());
                        })
                      }
                    >
                      Choose file
                    </button>
                  </article>
                ))}
              </div>
              <div className="note">
                <h3>Speech stays speech</h3>
                <p>
                  Recording creates a local audio file. Transcription creates
                  text. Nothing typed or spoken here can run arbitrary shell
                  commands or send a message to someone else.
                </p>
                <p>
                  Vocal separation requires a model and considerably more
                  resources than basic dictation. No model is silently
                  downloaded by this screen.
                </p>
              </div>
            </>
          ) : view === "Command" ? (
            <div className="chat-workspace">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">ONE PLACE TO START</p>
                  <h1>What do you want to do?</h1>
                  <p>
                    A local tool finder. Describe a task, then choose the right
                    tool.
                  </p>
                </div>
                <span className="count-pill">No cloud AI</span>
              </div>
              {!chat.length ? (
                <div className="suggestions">
                  {[
                    "Make an image smaller",
                    "Remove audio from a video",
                    "Merge PDF files",
                    "Create a QR code",
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => {
                        setMessage(q);
                      }}
                    >
                      {q}
                      <ArrowUpRight />
                    </button>
                  ))}
                </div>
              ) : (
                <div className="conversation">
                  {chat.map((m, i) => (
                    <div className="exchange" key={i}>
                      <div className="bubble">{m.query}</div>
                      <p>
                        {m.matches.length
                          ? "These tools may help. Choose one to review its settings."
                          : "No matching tools yet. Try “image”, “audio”, “PDF”, or “text”."}
                      </p>
                      <div className="match-list">
                        {m.matches.map((t) => (
                          <button key={t.id} onClick={() => choose(t)}>
                            <span>
                              {t.name}
                              <small>{t.description}</small>
                            </span>
                            <ArrowRight />
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <form
                className="composer"
                onSubmit={(e) => {
                  e.preventDefault();
                  send();
                }}
              >
                <input
                  aria-label="Describe a task"
                  placeholder="Try: resize an image, extract audio, format JSON…"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                />
                <button
                  className="primary"
                  type="submit"
                  aria-label="Find matching tools"
                >
                  <PaperPlaneTilt size={21} />
                </button>
              </form>
            </div>
          ) : (
            <>
              {view === "All tools" && !query ? (
                <section className="hero">
                  <div className="hero-copy">
                    <span className="eyebrow">
                      A LITTLE LESS FRICTION. A LOT MORE MAKING.
                    </span>
                    <h1>
                      Your next idea.
                      <br />
                      All the right tools.
                    </h1>
                    <p>
                      Fix a photo. Shape a soundtrack. Get the small stuff out
                      of the way.
                    </p>
                    <button
                      className="hero-action"
                      onClick={() => choose(toolById["image-enhance"])}
                    >
                      Make something better <ArrowRight size={21} />
                    </button>
                  </div>
                  <div className="hero-art" aria-hidden="true">
                    <div className="art-flower">
                      <Image size={68} weight="duotone" />
                    </div>
                    <div className="art-wave">
                      <Waveform size={90} weight="bold" />
                    </div>
                    <div className="art-code">
                      <Code size={54} />
                    </div>
                    <span className="art-label">MANY TOOLS. ONE PLACE.</span>
                  </div>
                </section>
              ) : null}
              <div className="section-heading compact">
                <div>
                  <p className="eyebrow">
                    {query ? "SEARCH RESULTS" : "PICK A TOOL. KEEP YOUR FLOW."}
                  </p>
                  <h2>{query ? `Results for “${query}”` : view}</h2>
                </div>
                <span className="count-pill">{visible.length} tools</span>
              </div>
              {!visible.length ? (
                <Empty
                  icon={MagnifyingGlass}
                  title="Nothing here yet"
                  text={
                    view === "Favorites"
                      ? "Star a tool to keep it close."
                      : "Try a shorter search or a different category."
                  }
                />
              ) : (
                <div className="tool-grid">
                  {visible.map((t) => {
                    const Icon = icons[t.category];
                    return (
                      <article key={t.id} className="tool-card">
                        <button className="tool-open" onClick={() => choose(t)}>
                          <span className={"tool-symbol c-" + t.kind}>
                            <Icon size={26} weight="duotone" />
                          </span>
                          <span className="tool-category">{t.category}</span>
                          <h3>{t.name}</h3>
                          <p>{t.description}</p>
                          <span className="tool-bottom">
                            {t.kind === "engine"
                              ? "Optional engine"
                              : t.kind === "download"
                                ? "Online source"
                                : "Local processing"}
                            <ArrowUpRight size={19} />
                          </span>
                        </button>
                        <button
                          className={
                            "favorite " +
                            (favorites.includes(t.id) ? "is-favorite" : "")
                          }
                          aria-label={
                            (favorites.includes(t.id)
                              ? "Unfavorite "
                              : "Favorite ") + t.name
                          }
                          onClick={() => favorite(t.id)}
                        >
                          <Star
                            size={19}
                            weight={
                              favorites.includes(t.id) ? "fill" : "regular"
                            }
                          />
                        </button>
                      </article>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </main>
      <aside className="tray">
        <div className="tray-heading">
          <h2>File tray</h2>
          <span>{files.length}</span>
        </div>
        <p className="tray-intro">
          Drop files anywhere.
          <br />
          Use them across your tools.
        </p>
        <button className="dropzone" onClick={pick}>
          <Plus size={30} />
          <span>Add your files</span>
          <small>Images, audio, video, PDFs</small>
        </button>
        <div className="tray-files">
          {files.map((f, i) => (
            <div className="tray-file" key={f.path}>
              <span className="file-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div title={f.path}>
                <strong>{f.name}</strong>
                <small>{bytes(f.size)}</small>
              </div>
              <button
                aria-label={"Remove " + f.name}
                onClick={() => setFiles(files.filter((x) => x.path !== f.path))}
              >
                <X size={16} />
              </button>
              {files.length > 1 && <div className="file-order"><button aria-label={'Move up ' + f.name} disabled={i === 0} onClick={() => setFiles(prev => { const next = [...prev]; [next[i-1], next[i]] = [next[i], next[i-1]]; return next; })}>↑</button><button aria-label={'Move down ' + f.name} disabled={i === files.length-1} onClick={() => setFiles(prev => { const next = [...prev]; [next[i+1], next[i]] = [next[i], next[i+1]]; return next; })}>↓</button></div>}
            </div>
          ))}
        </div>
        {files.length > 0 && (
          <button className="text-button" onClick={() => setFiles([])}>
            Clear tray
          </button>
        )}
        <div className="voice-tile">
          <button
            className="text-button"
            onClick={() => attempt(() => api.launchVoice())}
          >
            Open Voice companion <ArrowUpRight size={14} />
          </button>
          <Microphone size={25} />
          <h3>Say it. Save it.</h3>
          <p>Record up to two minutes, then transcribe with a local model.</p>
          <button
            className={recording ? "record-button recording" : "record-button"}
            onClick={record}
          >
            {recording ? (
              <>
                <Stop size={18} weight="fill" /> Stop recording
              </>
            ) : (
              <>
                <Microphone size={18} /> Record a thought
              </>
            )}
          </button>
        </div>
        <div className="tray-footer">
          <span className="status-dot ready" />{" "}
          {active.length
            ? `${active.length} job${active.length === 1 ? "" : "s"} in progress`
            : "Ready to make something"}
        </div>
      </aside>
      {selected && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section
            className="tool-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="tool-title"
          >
            <div className="dialog-heading">
              <span className={"tool-symbol c-" + selected.kind}>
                {React.createElement(icons[selected.category], {
                  size: 27,
                  weight: "duotone",
                })}
              </span>
              <div>
                <p className="eyebrow">{selected.category}</p>
                <h2 id="tool-title">{selected.name}</h2>
              </div>
              <button
                autoFocus
                className="icon-button"
                aria-label="Close tool"
                onClick={() => setSelected(null)}
              >
                <X size={23} />
              </button>
            </div>
            <p>{selected.description}</p>
            {error && (
              <div role="alert" className="error">
                {error}
              </div>
            )}
            <div className="dialog-body">
              <VisualWorkspace key={selected.id} files={files} tool={selected} options={options} onChange={setOptions} api={api} />
              {preview && selected.id === "image-crop" ? (
                <CropPreview
                  preview={preview}
                  options={options}
                  onChange={setOptions}
                />
              ) : (
                preview && (
                  <div className="image-preview">
                    <img src={preview.url} alt="Selected input preview" />
                  </div>
                )
              )}
              {selected.kind === "text" ? (
                <label className="text-input">
                  Input text
                  <textarea
                    aria-label="Input text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type or paste your content here…"
                    spellCheck={false}
                  />
                </label>
              ) : selected.kind !== "download" ? (
                <div className="input-summary">
                  <Stack size={22} />
                  <span>
                    {files.length
                      ? `${files.length} file${files.length === 1 ? "" : "s"} from your tray`
                      : "Add input files to continue"}
                    <small>
                      {files
                        .slice(0, 3)
                        .map((f) => f.name)
                        .join(" · ")}
                    </small>
                  </span>
                  <button className="secondary" onClick={pick}>
                    Add files
                  </button>
                </div>
              ) : null}
              <div className="option-grid">
                {selected.options.map((o) => (
                  <label key={o.key}>
                    {o.label}
                    {selected.id === 'text-diff' && o.key === 'other' ? <textarea value={options[o.key] ?? ''} onChange={e => setOptions({...options, [o.key]:e.target.value})} rows={6} spellCheck={false} /> : o.type === "select" ? (
                      <select
                        value={options[o.key]}
                        onChange={(e) =>
                          setOptions({ ...options, [o.key]: e.target.value })
                        }
                      >
                        {o.options.map((x) => (
                          <option key={x}>{x}</option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type={o.type}
                        min={o.min}
                        max={o.max}
                        step="any"
                        value={options[o.key] ?? ""}
                        onChange={(e) =>
                          setOptions({
                            ...options,
                            [o.key]:
                              o.type === "number"
                                ? e.target.value === ""
                                  ? ""
                                  : Number(e.target.value)
                                : e.target.value,
                          })
                        }
                      />
                    )}
                  </label>
                ))}
              </div>
              {selected.kind === "engine" && (
                <p className="hint">
                  Requires a configured local engine. Check Engines before your
                  first run.
                </p>
              )}
              {selected.kind === "download" && (
                <p className="hint">
                  Use a public URL for content you own or have permission to
                  download. Site restrictions and availability still apply.
                </p>
              )}
            </div>
            <footer className="dialog-footer">
              <span>New output files · originals preserved</span>
              <button
                className="primary"
                disabled={
                  !["text", "download"].includes(selected.kind) && !files.length
                }
                onClick={run}
              >
                <Play size={19} weight="fill" /> Run tool
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
function Empty({ icon: Icon, title, text }) {
  return (
    <div className="empty">
      <Icon size={46} weight="duotone" />
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
