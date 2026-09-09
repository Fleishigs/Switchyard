import React, { useEffect, useRef, useState } from "react";
import {
  X,
  ArrowCounterClockwise,
  ArrowClockwise,
  FolderOpen,
  Play,
  Check,
  CircleNotch,
} from "@phosphor-icons/react";
import { tools, toolById, defaults } from "../shared/catalog.mjs";
import {
  acceptsFile,
  combinesFiles,
  describeFile,
  fileKey,
  uniqueFiles,
} from "../shared/workflows.mjs";
import MediaTimeline, { isMediaTool } from "./MediaTimeline.jsx";
import DocumentPreview from "./DocumentPreview.jsx";
import CropPreview from "./CropPreview.jsx";
import NumberField from "./NumberField.jsx";
import ImageComparison from "./ImageComparison.jsx";
import { diffLines } from "diff";
import "./workbench.css";

function ImageView({ file, api }) {
  const [image, setImage] = useState(null),
    [error, setError] = useState(""),
    [detail, setDetail] = useState(false);
  useEffect(() => {
    let live = true;
    setImage(null);
    setError("");
    api
      .preview(file, detail)
      .then((v) => {
        if (live) setImage(v);
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    return () => {
      live = false;
    };
  }, [file, api, detail]);
  return error ? (
    <p role="alert" className="error">
      {error}
    </p>
  ) : image ? (
    <figure className={"work-image" + (detail ? " image-detail" : "")}>
      <button className="secondary" onClick={() => setDetail(!detail)}>
        {detail ? "Fit image" : "Inspect detail"}
      </button>
      <div className="image-detail-scroll">
        <img src={image.url} alt="Image preview" />
      </div>
      <figcaption>
        {detail
          ? "Detail preview, up to 4096 pixels ? Scroll to inspect ? "
          : ""}
        {image.width} × {image.height} pixels
      </figcaption>
    </figure>
  ) : (
    <p role="status">Loading image…</p>
  );
}
function FileView({ file, api }) {
  if (/\.(png|jpe?g|webp|avif|tiff?|gif|svg)$/i.test(file))
    return <ImageView file={file} api={api} />;
  if (/\.pdf$/i.test(file)) return <DocumentPreview file={file} api={api} />;
  if (/\.(wav|mp3|flac|m4a|aac|ogg|opus|aiff?|mp4|mov|mkv|webm)$/i.test(file))
    return <MediaTimeline file={file} api={api} />;
  return (
    <p className="work-empty">
      This file is ready to save. Text results appear below.
    </p>
  );
}

export default function ToolWorkbench({
  initialTool,
  library,
  jobs,
  api,
  onAddFiles,
  onClose,
  initialText = "",
}) {
  const [tool, setTool] = useState(initialTool);
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);
  const compatible = uniqueFiles(library).filter((f) => acceptsFile(tool, f));
  const combined = combinesFiles(tool),
    needsFiles = !["text", "download"].includes(tool.kind);
  const [paths, setPaths] = useState(() => {
    const list = uniqueFiles(library).filter((f) =>
      acceptsFile(initialTool, f),
    );
    return (combinesFiles(initialTool) ? list : list.slice(-1)).map(
      (f) => f.path,
    );
  });
  const [batch, setBatch] = useState(false),
    [inspect, setInspect] = useState("");
  const inputs = paths
    .map((p) => compatible.find((f) => fileKey(f.path) === fileKey(p)))
    .filter(Boolean);
  const source = inputs.find((f) => f.path === inspect) || inputs[0];
  const [history, setHistory] = useState({
    past: [],
    value: defaults(tool),
    future: [],
  });
  const options = history.value,
    gesture = useRef(0);
  const [text, setText] = useState(initialText),
    [error, setError] = useState(""),
    [jobId, setJobId] = useState("");
  const [tab, setTab] = useState("source"),
    [output, setOutput] = useState(""),
    [image, setImage] = useState(null);
  const [media, setMedia] = useState(null),
    [starting, setStarting] = useState(false);
  const job = jobs.find((j) => j.id === jobId),
    running = starting || ["queued", "running"].includes(job?.status);
  const resultFile = job?.outputs?.includes(output)
    ? output
    : job?.outputs?.[0];
  const initializedMedia = useRef("");
  const receiveMedia = (data) => {
    setMedia(data);
    const key = tool.id + source?.path;
    if (initializedMedia.current !== key) {
      initializedMedia.current = key;
      if (["audio-trim", "video-trim", "video-gif"].includes(tool.id))
        setHistory({
          past: [],
          future: [],
          value: {
            ...defaults(tool),
            start: 0,
            duration:
              tool.id === "video-gif"
                ? Math.min(10, data.duration)
                : data.duration,
          },
        });
    }
  };
  const trim = ["audio-trim", "video-trim", "video-gif"].includes(tool.id);
  const changed =
    !!job &&
    (JSON.stringify(job.options) !== JSON.stringify(options) ||
      JSON.stringify(job.inputs) !==
        JSON.stringify(inputs.map((f) => f.path)) ||
      job.inputText !== text);
  const update = (next) => {
    const now = Date.now(),
      merge = now - gesture.current < 450;
    gesture.current = now;
    setHistory((h) =>
      JSON.stringify(next) === JSON.stringify(h.value)
        ? h
        : {
            past:
              merge && h.past.length ? h.past : [...h.past.slice(-49), h.value],
            value: next,
            future: [],
          },
    );
  };
  const undo = () =>
    setHistory((h) =>
      h.past.length
        ? {
            past: h.past.slice(0, -1),
            value: h.past.at(-1),
            future: [h.value, ...h.future],
          }
        : h,
    );
  const redo = () =>
    setHistory((h) =>
      h.future.length
        ? {
            past: [...h.past, h.value],
            value: h.future[0],
            future: h.future.slice(1),
          }
        : h,
    );
  function reset(nextTool = tool) {
    setHistory({
      past: [],
      value: {
        ...defaults(nextTool),
        ...(trim && media && nextTool.id === tool.id
          ? {
              start: 0,
              duration:
                nextTool.id === "video-gif"
                  ? Math.min(10, media.duration)
                  : media.duration,
            }
          : {}),
      },
      future: [],
    });
    gesture.current = 0;
  }
  async function addFiles(incoming) {
    const added = uniqueFiles(incoming);
    onAddFiles(added);
    const accepted = added.filter((f) => acceptsFile(tool, f));
    if (!accepted.length) {
      setError(
        "These files do not match this operation. Choose a compatible file or use the batch converter.",
      );
      return;
    }
    setPaths(
      (combined || batch ? accepted : accepted.slice(-1)).map((f) => f.path),
    );
    setInspect("");
    setTab("source");
    setError("");
  }
  async function pick() {
    try {
      const incoming = await api.pick();
      if (incoming.length) await addFiles(incoming);
    } catch (e) {
      setError(e.message);
    }
  }
  function operation(id) {
    const next = toolById[id];
    setTool(next);
    setHistory({ past: [], value: defaults(next), future: [] });
    setJobId("");
    setTab("source");
    setImage(null);
    setMedia(null);
    setError("");
    const eligible = uniqueFiles(library).filter((f) => acceptsFile(next, f));
    const retained = inputs.filter((f) => acceptsFile(next, f));
    setPaths(
      (combinesFiles(next)
        ? eligible
        : retained.length
          ? batch
            ? retained
            : retained.slice(-1)
          : eligible.slice(-1)
      ).map((f) => f.path),
    );
  }
  useEffect(() => {
    let live = true;
    setImage(null);
    setMedia(null);
    if (
      source &&
      (["image", "ocr"].includes(tool.kind) || tool.id === "pdf-images")
    )
      api
        .preview(source.path)
        .then((p) => {
          if (!live) return;
          setImage(p);
          if (tool.id === "image-crop")
            setHistory({
              past: [],
              future: [],
              value: {
                ...defaults(tool),
                left: 0,
                top: 0,
                width: p.width,
                height: p.height,
              },
            });
        })
        .catch((e) => {
          if (live) setError(e.message);
        });
    return () => {
      live = false;
    };
  }, [source?.path, tool.id]);
  useEffect(() => {
    if (job?.status === "done" || job?.status === "partial") {
      setTab("result");
      setOutput(job.outputs?.[0] || "");
    }
  }, [job?.status]);
  useEffect(() => {
    const listener = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "z" &&
        !["INPUT", "TEXTAREA"].includes(e.target.tagName)
      ) {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", listener);
    return () => window.removeEventListener("keydown", listener);
  }, []);
  async function run() {
    setStarting(true);
    setError("");
    document
      .querySelectorAll(".workbench audio,.workbench video")
      .forEach((p) => p.pause());
    try {
      const id = await api.run({
        toolId: tool.id,
        files: inputs.map((f) => f.path),
        options,
        text,
      });
      setJobId(id);
      setTab("result");
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }
  async function useResult() {
    if (tool.kind === "text" && typeof job?.text === "string") {
      setText(job.text);
      setTab("source");
      return;
    }
    try {
      const files = await api.addPaths([resultFile]);
      onAddFiles(files);
      if (acceptsFile(tool, files[0])) {
        setPaths([files[0].path]);
        setInspect("");
        setBatch(false);
        setTab("source");
        reset();
      } else
        setError(
          "The result is in your file library. Choose a compatible operation to continue editing it.",
        );
    } catch (e) {
      setError(e.message);
    }
  }
  function order(index, direction) {
    const next = [...paths];
    [next[index], next[index + direction]] = [
      next[index + direction],
      next[index],
    ];
    setPaths(next);
  }
  return (
    <div className="workbench-backdrop">
      <section
        className="workbench"
        role="dialog"
        aria-modal="true"
        aria-label={tool.name}
        onDragOver={(e) => e.preventDefault()}
        onDrop={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          try {
            await addFiles(
              await api.addPaths(
                [...e.dataTransfer.files].map((f) => api.pathForFile(f)),
              ),
            );
          } catch (error) {
            setError(error.message);
          }
        }}
      >
        <header className="workbench-header">
          <div>
            <small>{tool.category}</small>
            <h2>{tool.name}</h2>
          </div>
          <div className="workbench-history">
            <button
              className="icon-button"
              aria-label="Undo adjustment"
              disabled={!history.past.length}
              onClick={undo}
            >
              <ArrowCounterClockwise size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Redo adjustment"
              disabled={!history.future.length}
              onClick={redo}
            >
              <ArrowClockwise size={20} />
            </button>
            <button className="text-button" onClick={() => reset()}>
              Reset
            </button>
          </div>
          <button
            className="icon-button"
            aria-label="Close tool"
            onClick={onClose}
          >
            <X size={24} />
          </button>
        </header>
        <aside className="workbench-settings">
          <label>
            Operation
            <select
              aria-label="Operation"
              value={tool.id}
              onChange={(e) => operation(e.target.value)}
            >
              {tools
                .filter(
                  (t) =>
                    t.category === tool.category && t.id !== "batch-convert",
                )
                .map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
            </select>
          </label>
          <p className="workbench-description">{tool.description}</p>
          {needsFiles && (
            <section className="workbench-inputs">
              <div className="workbench-section-heading">
                <h3>{combined ? "Files in output order" : "Input"}</h3>
                <button className="text-button" onClick={pick}>
                  <FolderOpen size={16} />{" "}
                  {source ? "Choose another" : "Choose file"}
                </button>
              </div>
              {!combined && !batch && (
                <label>
                  Edit file
                  <select
                    aria-label="Edit file"
                    value={source?.path || ""}
                    onChange={(e) => {
                      setPaths([e.target.value]);
                      setInspect("");
                      setTab("source");
                      reset();
                    }}
                  >
                    {!source && <option value="">Choose a file</option>}
                    {compatible.map((f) => (
                      <option value={f.path} key={fileKey(f.path)}>
                        {describeFile(f, jobs)}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(combined || batch) && (
                <div className="workbench-file-list">
                  {[
                    ...inputs,
                    ...compatible.filter(
                      (f) =>
                        !inputs.some(
                          (i) => fileKey(i.path) === fileKey(f.path),
                        ),
                    ),
                  ].map((f) => {
                    const index = paths.indexOf(f.path);
                    return (
                      <div key={fileKey(f.path)}>
                        <label title={f.path}>
                          <input
                            type="checkbox"
                            checked={index >= 0}
                            onChange={(e) =>
                              setPaths(
                                e.target.checked
                                  ? [...paths, f.path]
                                  : paths.filter((p) => p !== f.path),
                              )
                            }
                          />
                          <span>{describeFile(f, jobs)}</span>
                        </label>
                        {combined && index >= 0 && (
                          <span>
                            <button
                              aria-label={"Earlier " + f.name}
                              disabled={index === 0}
                              onClick={() => order(index, -1)}
                            >
                              ↑
                            </button>
                            <button
                              aria-label={"Later " + f.name}
                              disabled={index === paths.length - 1}
                              onClick={() => order(index, 1)}
                            >
                              ↓
                            </button>
                            <small>{index + 1}</small>
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {!combined && (
                <label className="workbench-check">
                  <input
                    type="checkbox"
                    checked={batch}
                    onChange={(e) => {
                      setBatch(e.target.checked);
                      if (!e.target.checked)
                        setPaths(source ? [source.path] : []);
                    }}
                  />
                  Batch processing
                </label>
              )}
              {(combined || batch) && inputs.length > 1 && (
                <label>
                  Inspect selected file
                  <select
                    aria-label="Inspect selected file"
                    value={source?.path || ""}
                    onChange={(e) => setInspect(e.target.value)}
                  >
                    {inputs.map((f) => (
                      <option value={f.path} key={f.path}>
                        {f.name}
                      </option>
                    ))}
                  </select>
                  <small>
                    {combined
                      ? "The numbered list determines output order."
                      : "Only checked files run. The same settings apply to each."}
                  </small>
                </label>
              )}
              {source && (
                <p className="workbench-filepath" title={source.path}>
                  {source.path}
                </p>
              )}
            </section>
          )}
          <section className="workbench-options">
            <h3>Adjustments</h3>
            {tool.options
              .filter((o) => !(trim && ["start", "duration"].includes(o.key)))
              .map((o) => (
                <label key={o.key}>
                  {o.label}
                  {o.type === "select" ? (
                    <select
                      value={options[o.key]}
                      onChange={(e) =>
                        update({ ...options, [o.key]: e.target.value })
                      }
                    >
                      {o.options.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  ) : o.type === "number" ? (
                    <NumberField
                      value={options[o.key]}
                      min={o.min}
                      max={o.max}
                      onChange={(value) =>
                        update({ ...options, [o.key]: value })
                      }
                    />
                  ) : tool.id === "text-diff" && o.key === "other" ? (
                    <textarea
                      aria-label="Second text"
                      rows={8}
                      value={options.other}
                      onChange={(e) =>
                        update({ ...options, other: e.target.value })
                      }
                    />
                  ) : (
                    <input
                      type={o.type}
                      value={options[o.key] ?? ""}
                      onChange={(e) =>
                        update({ ...options, [o.key]: e.target.value })
                      }
                    />
                  )}
                </label>
              ))}
            {!tool.options.length && (
              <p>This operation uses its recommended settings.</p>
            )}
            {trim && (
              <p>
                Set the In and Out points on the timeline. Only that interval is
                exported.
              </p>
            )}
          </section>
          {tool.id === "image-upscale" && (
            <p className="engine-credit">
              Powered locally by Upscayl NCNN. Choose a photo or artwork model;
              AI-generated details need visual review.
            </p>
          )}
        </aside>
        <main className="workbench-stage">
          <nav className="workbench-tabs" aria-label="Editor view">
            <button
              aria-pressed={tab === "source"}
              onClick={() => setTab("source")}
            >
              Source
            </button>
            <button
              disabled={!job}
              aria-pressed={tab === "result"}
              onClick={() => setTab("result")}
            >
              Result {job?.status === "done" && <Check size={14} />}
            </button>
            {changed && (
              <span>
                Adjustments changed · create a new result to apply them
              </span>
            )}
          </nav>
          <div className="workbench-canvas">
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {tab === "source" ? (
              <>
                {tool.kind === "text" && (
                  <label className="workbench-text">
                    Input text
                    <textarea
                      aria-label="Input text"
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      spellCheck={false}
                      placeholder="Paste or type your text here"
                    />
                  </label>
                )}
                {source && isMediaTool(tool) && (
                  <MediaTimeline
                    key={tool.id + source.path}
                    file={source.path}
                    tool={tool}
                    options={options}
                    onChange={update}
                    onInfo={receiveMedia}
                    api={api}
                  />
                )}
                {source && tool.kind === "pdf" && tool.id !== "pdf-images" && (
                  <DocumentPreview
                    file={source.path}
                    tool={tool}
                    options={options}
                    onChange={update}
                    api={api}
                  />
                )}
                {image &&
                  (["image", "ocr"].includes(tool.kind) ||
                    tool.id === "pdf-images") &&
                  (tool.id === "image-crop" ? (
                    <CropPreview
                      preview={image}
                      options={options}
                      onChange={update}
                    />
                  ) : (
                    <figure className="work-image">
                      <img src={image.url} alt="Selected input preview" />
                      <figcaption>
                        {image.width} × {image.height} pixels
                      </figcaption>
                    </figure>
                  ))}
                {needsFiles && !source && (
                  <div className="workbench-empty">
                    <FolderOpen size={42} />
                    <h3>Choose the file you want to work on</h3>
                    <p>
                      Your library stays available. This operation uses only its
                      selected input.
                    </p>
                    <button className="primary" onClick={pick}>
                      Choose file
                    </button>
                  </div>
                )}
                {tool.kind === "download" && (
                  <div className="workbench-empty">
                    <h3>Download to your local library</h3>
                    <p>
                      Paste the URL in the settings. The result will play here
                      when the download finishes.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <>
                {running && (
                  <div className="workbench-empty" role="status">
                    <CircleNotch className="spin" size={36} />
                    <h3>
                      {job?.status === "queued"
                        ? "Waiting in queue"
                        : "Creating your result"}
                    </h3>
                    <p>
                      {inputs.length > 1
                        ? `${inputs.length} selected files`
                        : source?.name}
                    </p>
                    {job?.progress !== undefined && (
                      <progress max="100" value={job.progress} />
                    )}
                  </div>
                )}
                {job?.error && (
                  <p role="alert" className="error">
                    {job.error}
                  </p>
                )}
                {!running && resultFile && (
                  <>
                    {job.outputs.length > 1 && (
                      <label className="workbench-output-select">
                        Result file
                        <select
                          value={resultFile}
                          onChange={(e) => setOutput(e.target.value)}
                        >
                          {job.outputs.map((p) => (
                            <option key={p} value={p}>
                              {p.split(/[\\/]/).pop()}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <FileView key={resultFile} file={resultFile} api={api} />
                    {job.toolId.startsWith("image-") &&
                      job.toolId !== "image-contact" && (
                        <ImageComparison
                          job={{
                            ...job,
                            inputs: [
                              job.inputs?.[job.outputs.indexOf(resultFile)] ||
                                job.inputs?.[0],
                            ],
                            outputs: [resultFile],
                          }}
                          api={api}
                        />
                      )}
                  </>
                )}
                {!running && job?.text !== undefined && (
                  <div className="workbench-text-result">
                    <pre>
                      {job.toolId === "text-diff"
                        ? diffLines(
                            job.inputText || "",
                            job.options.other || "",
                          ).map((part, i) => (
                            <span
                              key={i}
                              className={
                                part.added
                                  ? "diff-added"
                                  : part.removed
                                    ? "diff-removed"
                                    : ""
                              }
                            >
                              {part.value}
                            </span>
                          ))
                        : job.text.slice(0, 100000)}
                    </pre>
                    <button
                      className="secondary"
                      onClick={() =>
                        api.copy(job.text).catch((e) => setError(e.message))
                      }
                    >
                      Copy result
                    </button>
                  </div>
                )}
                {job?.log && (
                  <details className="workbench-log">
                    <summary>Processing details</summary>
                    <pre>{job.log}</pre>
                  </details>
                )}
              </>
            )}
          </div>
        </main>
        <footer className="workbench-footer">
          <span>
            {needsFiles
              ? `${inputs.length} selected ${inputs.length === 1 ? "file" : "files"}`
              : "Local workspace"}
            {job?.finishedAt &&
              ` · Last run ${((job.finishedAt - job.startedAt) / 1000).toFixed(1)}s`}
          </span>
          {tab === "result" && resultFile && !running && (
            <>
              <button className="secondary" onClick={useResult}>
                Use result as input
              </button>
              <button
                className="secondary"
                onClick={() =>
                  api.exportFile(resultFile).catch((e) => setError(e.message))
                }
              >
                Save as…
              </button>
            </>
          )}
          {running ? (
            <button
              className="secondary"
              disabled={!jobId}
              onClick={() =>
                api.cancel(jobId).catch((e) => setError(e.message))
              }
            >
              Cancel processing
            </button>
          ) : (
            <button
              className="primary"
              disabled={needsFiles && (!inputs.length || (trim && !media))}
              onClick={run}
            >
              <Play size={18} weight="fill" />
              Create result
            </button>
          )}
        </footer>
      </section>
    </div>
  );
}
