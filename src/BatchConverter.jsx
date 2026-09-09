import { useState } from "react";
import { ArrowRight, Plus, Stack, WarningCircle } from "@phosphor-icons/react";
import { formatInfo, supportedInputs } from "../shared/formats.mjs";
export default function BatchConverter({ files, onAdd, onRun }) {
  const [targets, setTargets] = useState({}),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const items = files.map((f) => ({ ...f, ...formatInfo(f.name) })),
    valid = items.filter((f) => f.targets.length),
    allTargets = [...new Set(valid.flatMap((f) => f.targets))];
  async function run() {
    try {
      setBusy(true);
      setError("");
      await onRun(
        Object.fromEntries(
          items.map((f) => [f.path, targets[f.path] || f.suggested]),
        ),
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function apply(format) {
    setTargets((previous) => ({
      ...previous,
      ...Object.fromEntries(
        valid
          .filter((f) => f.targets.includes(format))
          .map((f) => [f.path, format]),
      ),
    }));
  }
  return (
    <section className="batch-workspace">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MANY FILES. ONE RUN.</p>
          <h1>Batch converter</h1>
          <p>
            Choose a destination for every file. Originals stay exactly where
            they are.
          </p>
        </div>
        <span className="count-pill">
          {supportedInputs.length} input extensions
        </span>
      </div>
      <div className="batch-banner">
        <Stack size={33} />
        <div>
          <h3>A converter that knows its limits.</h3>
          <p>
            Images, media, documents, spreadsheets, slides, PDFs, and archives.
            Targets are matched to the file extension; the engine validates the
            actual contents when processing.
          </p>
        </div>
      </div>
      {error && (
        <div role="alert" className="error">
          {error}
        </div>
      )}
      {!items.length ? (
        <button className="batch-empty" onClick={onAdd}>
          <Plus size={40} />
          <h2>Drop in your next batch</h2>
          <p>Mix file types. Set each destination. Convert them together.</p>
          <span className="primary">Choose files</span>
        </button>
      ) : (
        <>
          <div className="batch-toolbar">
            <span>
              {valid.length} supported · {items.length - valid.length}{" "}
              unsupported
            </span>
            <label>
              Apply to compatible files
              <select
                aria-label="Apply format to compatible files"
                defaultValue=""
                onChange={(e) => {
                  if (e.target.value) apply(e.target.value);
                }}
              >
                <option value="">Choose format</option>
                {allTargets.map((t) => (
                  <option key={t} value={t}>
                    {t.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>
            <button className="secondary" onClick={onAdd}>
              <Plus size={17} /> Add more
            </button>
          </div>
          <div className="batch-list">
            {items.map((f, i) => (
              <article className="batch-row" key={f.path}>
                <span className="file-index">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="batch-file">
                  <strong>{f.name}</strong>
                  <small>
                    {f.label} · {f.extension.toUpperCase()}
                  </small>
                  <p>{f.note}</p>
                </div>
                <ArrowRight size={19} />
                {f.targets.length ? (
                  <label>
                    Convert to
                    <select
                      aria-label={"Output format for " + f.name}
                      value={targets[f.path] || f.suggested}
                      onChange={(e) =>
                        setTargets({ ...targets, [f.path]: e.target.value })
                      }
                    >
                      {f.targets.map((t) => (
                        <option key={t} value={t}>
                          {t.toUpperCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <span className="unsupported">
                    <WarningCircle size={18} /> Unsupported
                  </span>
                )}
              </article>
            ))}
          </div>
          <div className="batch-footer">
            <p>
              Each file gets its own output folder. A report records successes
              and failures.
            </p>
            <button
              className="primary"
              disabled={!valid.length || busy}
              onClick={run}
            >
              {busy ? "Adding to queue…" : `Convert ${valid.length} files`}
              <ArrowRight size={19} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
