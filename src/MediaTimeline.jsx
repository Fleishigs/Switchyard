import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, SkipBack, Waveform } from "@phosphor-icons/react";
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const stamp = (n) =>
  `${Math.floor(n / 60)}:${(n % 60).toFixed(3).padStart(6, "0")}`;
export const isMediaTool = (t) =>
  ["audio", "video"].includes(t?.kind) ||
  ["voice-transcribe", "voice-vocals"].includes(t?.id);
function TimeField({ label, value, onChange }) {
  const [draft, setDraft] = useState(stamp(value)),
    editing = useRef(false),
    cancel = useRef(false);
  useEffect(() => {
    if (!editing.current) setDraft(stamp(value));
  }, [value]);
  return (
    <label>
      {label}
      <input
        aria-label={label}
        value={draft}
        onFocus={() => {
          editing.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          editing.current = false;
          const parts = draft.trim().split(":").map(Number);
          const n = parts.reduce((a, b) => a * 60 + b, 0);
          if (
            !cancel.current &&
            draft.trim() &&
            parts.length <= 3 &&
            parts.every(Number.isFinite)
          )
            onChange(n);
          cancel.current = false;
          setDraft(stamp(value));
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            e.stopPropagation();
            cancel.current = true;
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}
export default function MediaTimeline({
  file,
  tool,
  options = {},
  onChange,
  onInfo,
  api,
}) {
  const [info, setInfo] = useState(null),
    [peaks, setPeaks] = useState([]),
    [strip, setStrip] = useState(null),
    [error, setError] = useState(""),
    [playing, setPlaying] = useState(false),
    [position, setPosition] = useState(0),
    [ready, setReady] = useState(false),
    [zoom, setZoom] = useState(1),
    [offset, setOffset] = useState(0);
  const player = useRef(null),
    selection = useRef(false),
    frame = useRef(0),
    notify = useRef(onInfo);
  notify.current = onInfo;
  const trim = ["audio-trim", "video-trim", "video-gif"].includes(tool?.id),
    capture = tool?.id === "video-frame",
    fade = ["audio-fade-in", "audio-fade-out"].includes(tool?.id);
  const duration = info?.duration || 1,
    step = info?.video ? 1 / (info.fps || 30) : 0.01,
    minSpan = Math.min(duration, info?.video ? step : 0.001);
  const start = clamp(Number(options.start) || 0, 0, duration - minSpan),
    end = clamp(
      start + (Number(options.duration) || minSpan),
      start + minSpan,
      duration,
    );
  const bounds = useRef({ start, end, options });
  bounds.current = { start, end, options };
  const length = duration / zoom,
    viewStart = clamp(offset, 0, duration - length),
    percent = (n) => ((n - viewStart) / length) * 100;
  useEffect(() => {
    let live = true;
    setInfo(null);
    setPeaks([]);
    setStrip(null);
    setError("");
    setReady(false);
    setPosition(0);
    setPlaying(false);
    setZoom(1);
    setOffset(0);
    selection.current = false;
    api
      .mediaPreview(file)
      .then((data) => {
        if (live) {
          setInfo(data);
          notify.current?.(data);
        }
      })
      .catch((e) => {
        if (live) setError(e.message);
      });
    api
      .waveform?.(file)
      .then((p) => {
        if (live) setPeaks(p);
      })
      .catch(() => {});
    api
      .thumbnails?.(file)
      .then((p) => {
        if (live) setStrip(p);
      })
      .catch(() => {});
    return () => {
      live = false;
      cancelAnimationFrame(frame.current);
    };
  }, [file, api]);
  useEffect(() => {
    if (player.current)
      player.current.playbackRate = tool?.id?.endsWith("-speed")
        ? clamp(Number(options.speed) || 1, 0.5, 2)
        : 1;
  }, [options.speed, tool?.id, ready]);
  useEffect(() => {
    if (capture && ready && player.current) {
      player.current.pause();
      player.current.currentTime = clamp(
        Number(options.start) || 0,
        0,
        duration - 0.001,
      );
    }
  }, [capture, options.start, ready, duration]);
  const seek = (n) => {
    if (!player.current || !ready) return;
    selection.current = false;
    const v = clamp(n, 0, duration);
    player.current.currentTime = v;
    setPosition(v);
    if (capture)
      onChange({
        ...bounds.current.options,
        start: Math.min(v, duration - 0.001),
      });
  };
  const tick = () => {
    const p = player.current;
    if (!p) return;
    setPosition(p.currentTime);
    if (selection.current && p.currentTime >= bounds.current.end) {
      p.pause();
      p.currentTime = bounds.current.end;
      selection.current = false;
    }
    if (!p.paused) frame.current = requestAnimationFrame(tick);
  };
  const play = async (selected) => {
    const p = player.current;
    if (!p || !ready) return;
    try {
      selection.current = selected;
      if (selected) p.currentTime = start;
      else if (p.ended) p.currentTime = 0;
      await p.play();
    } catch (e) {
      setError("Playback failed: " + e.message);
    }
  };
  const updateRange = (which, value) => {
    player.current?.pause();
    selection.current = false;
    const b = bounds.current;
    let s = b.start,
      e = b.end;
    if (which === "start")
      s = clamp(
        value,
        tool?.id === "video-gif" ? Math.max(0, e - 30) : 0,
        e - minSpan,
      );
    else
      e = clamp(
        value,
        s + minSpan,
        tool?.id === "video-gif" ? Math.min(duration, s + 30) : duration,
      );
    onChange?.({
      ...b.options,
      start: Number(s.toFixed(6)),
      duration: Number((e - s).toFixed(6)),
    });
    seek(which === "start" ? s : Math.max(s, e - step));
  };
  const drag = (event, which) => {
    event.preventDefault();
    const node = event.currentTarget,
      rect = node.parentElement.getBoundingClientRect(),
      initial = which === "start" ? start : end,
      grab =
        ((event.clientX - rect.left) / rect.width) * length +
        viewStart -
        initial;
    node.setPointerCapture(event.pointerId);
    node.onpointermove = (e) =>
      updateRange(
        which,
        ((e.clientX - rect.left) / rect.width) * length + viewStart - grab,
      );
    const clean = () => {
      node.onpointermove = null;
      node.onpointerup = null;
      node.onpointercancel = null;
      node.onlostpointercapture = null;
    };
    node.onpointerup = clean;
    node.onpointercancel = clean;
    node.onlostpointercapture = clean;
  };
  const actions = useRef();
  actions.current = { seek, play, updateRange, position, playing };
  useEffect(() => {
    if (!tool) return;
    const key = (e) => {
      if (
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(e.target.tagName) ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey
      )
        return;
      const a = actions.current;
      if (e.code === "Space") {
        e.preventDefault();
        a.playing ? player.current?.pause() : a.play(false);
      }
      if (["ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        player.current?.pause();
        a.seek(a.position + (e.key === "ArrowLeft" ? -step : step));
      }
      if (trim && ["i", "o"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        a.updateRange(
          e.key.toLowerCase() === "i" ? "start" : "end",
          a.position,
        );
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [tool, trim, step]);
  if (!info)
    return (
      <div className="media-loading" role={error ? "alert" : "status"}>
        <Waveform size={24} />
        {error || "Reading media…"}
      </div>
    );
  const Media = info.video ? "video" : "audio",
    visible = peaks.slice(
      Math.floor((viewStart / duration) * peaks.length),
      Math.ceil(((viewStart + length) / duration) * peaks.length),
    ),
    max = Math.max(0.01, ...peaks),
    path = visible
      .map(
        (p, i) =>
          `M${(i / Math.max(1, visible.length - 1)) * 800} ${48 - (p / max) * 42}V${48 + (p / max) * 42}`,
      )
      .join("");
  const changeZoom = (z) => {
    const next = clamp(z, 1, 128);
    setZoom(next);
    setOffset(
      clamp(position - duration / next / 2, 0, duration - duration / next),
    );
  };
  return (
    <section
      className="media-workspace"
      aria-label={tool ? "Source media preview" : "Processed media preview"}
    >
      <div className="media-heading">
        <strong title={info.name}>{info.name}</strong>
        <small>
          {stamp(duration)}
          {info.video
            ? ` · ${info.width} × ${info.height} · ${info.fps.toFixed(2)} fps`
            : ""}
        </small>
      </div>
      <Media
        ref={player}
        src={info.url}
        preload="auto"
        className={info.video ? "media-picture" : "media-audio"}
        playsInline
        onLoadedMetadata={() => setReady(true)}
        onError={() =>
          setError(
            "Preview cannot decode this codec. Convert a copy to MP4 or WAV first.",
          )
        }
        onPlay={() => {
          setPlaying(true);
          cancelAnimationFrame(frame.current);
          tick();
        }}
        onPause={() => {
          setPlaying(false);
          cancelAnimationFrame(frame.current);
          setPosition(player.current?.currentTime || 0);
        }}
        onTimeUpdate={() => setPosition(player.current?.currentTime || 0)}
        onSeeked={() => setPosition(player.current?.currentTime || 0)}
      />
      <div className="media-transport">
        <button
          className="icon-button"
          aria-label="Back to beginning"
          disabled={!ready}
          onClick={() => seek(0)}
        >
          <SkipBack size={20} />
        </button>
        <button
          className="media-play"
          aria-label={playing ? "Pause preview" : "Play preview"}
          disabled={!ready}
          onClick={() => (playing ? player.current.pause() : play(false))}
        >
          {playing ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button
          className="secondary"
          aria-label="Previous frame"
          disabled={!ready}
          onClick={() => {
            player.current.pause();
            seek(position - step);
          }}
        >
          −1 {info.video ? "frame" : "step"}
        </button>
        <button
          className="secondary"
          aria-label="Next frame"
          disabled={!ready}
          onClick={() => {
            player.current.pause();
            seek(position + step);
          }}
        >
          +1 {info.video ? "frame" : "step"}
        </button>
        <output aria-label="Playback position">{stamp(position)}</output>
        {trim && (
          <button
            className="secondary"
            disabled={!ready}
            onClick={() => play(true)}
          >
            Play selection
          </button>
        )}
      </div>
      {trim && (
        <div className="timeline-points">
          <TimeField
            label="In point"
            value={start}
            onChange={(v) => updateRange("start", v)}
          />
          <button
            className="text-button"
            disabled={!ready}
            onClick={() => updateRange("start", position)}
          >
            Mark In · I
          </button>
          <TimeField
            label="Out point"
            value={end}
            onChange={(v) => updateRange("end", v)}
          />
          <button
            className="text-button"
            disabled={!ready}
            onClick={() => updateRange("end", position)}
          >
            Mark Out · O
          </button>
          <span>{(end - start).toFixed(3)}s selected</span>
        </div>
      )}
      <div className="timeline-zoom">
        <button
          className="text-button"
          onClick={() => {
            setZoom(1);
            setOffset(0);
          }}
        >
          Fit whole file
        </button>
        <button
          className="text-button"
          aria-label="Zoom out timeline"
          disabled={zoom === 1}
          onClick={() => changeZoom(zoom / 2)}
        >
          −
        </button>
        <span>{zoom.toFixed(1)}×</span>
        <button
          className="text-button"
          aria-label="Zoom in timeline"
          disabled={zoom >= 128}
          onClick={() => changeZoom(zoom * 2)}
        >
          +
        </button>
        {trim && (
          <button
            className="text-button"
            onClick={() => {
              setZoom(clamp((duration / (end - start)) * 0.85, 1, 128));
              setOffset(Math.max(0, start - (end - start) * 0.075));
            }}
          >
            Fit selection
          </button>
        )}
      </div>
      <div className="media-track">
        {strip && (
          <img
            className="timeline-filmstrip"
            alt="Video frame overview"
            src={strip}
            style={{
              width: `${zoom * 100}%`,
              left: `${(-viewStart / length) * 100}%`,
            }}
          />
        )}
        <svg
          viewBox="0 0 800 96"
          preserveAspectRatio="none"
          aria-label={info.audio ? "Audio waveform" : "Video timeline"}
        >
          <path d={path} stroke="currentColor" strokeWidth="1" />
        </svg>
        {fade && (
          <svg
            className="fade-envelope"
            viewBox="0 0 800 96"
            preserveAspectRatio="none"
            aria-label="Export fade envelope"
          >
            <path
              d={
                tool.id === "audio-fade-in"
                  ? `M0 94 L${Math.min(1, Number(options.duration) / duration) * 800} 2 H800`
                  : `M0 2 H${Math.max(0, 1 - Number(options.duration) / duration) * 800} L800 94`
              }
              fill="none"
              stroke="var(--primary)"
              strokeWidth="3"
            />
          </svg>
        )}
        {trim && (
          <div
            className="media-selection"
            style={{
              left: `${clamp(percent(start), 0, 100)}%`,
              width: `${Math.max(0, clamp(percent(end), 0, 100) - clamp(percent(start), 0, 100))}%`,
            }}
          />
        )}
        <input
          className="media-scrub"
          type="range"
          aria-label={capture ? "Frame position" : "Seek preview"}
          min={viewStart}
          max={viewStart + length}
          step="0.001"
          value={clamp(position, viewStart, viewStart + length)}
          disabled={!ready}
          onChange={(e) => seek(Number(e.target.value))}
        />
        {percent(position) >= 0 && percent(position) <= 100 && (
          <div
            className="media-playhead"
            style={{ left: `${percent(position)}%` }}
          />
        )}
        {trim &&
          ["start", "end"].map((which) => {
            const value = which === "start" ? start : end;
            if (percent(value) < 0 || percent(value) > 100) return null;
            return (
              <button
                key={which}
                role="slider"
                aria-label={"Selection " + which}
                aria-valuemin={which === "start" ? 0 : start + minSpan}
                aria-valuemax={which === "start" ? end - minSpan : duration}
                aria-valuenow={value}
                aria-valuetext={stamp(value)}
                className="trim-handle"
                style={{ left: `${percent(value)}%` }}
                onPointerDown={(e) => drag(e, which)}
                onKeyDown={(e) => {
                  if (
                    ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)
                  ) {
                    e.preventDefault();
                    updateRange(
                      which,
                      e.key === "Home"
                        ? which === "start"
                          ? 0
                          : start + minSpan
                        : e.key === "End"
                          ? which === "start"
                            ? end - minSpan
                            : duration
                          : value + (e.key === "ArrowLeft" ? -step : step),
                    );
                  }
                }}
              >
                Ⅱ
              </button>
            );
          })}
      </div>
      <div className="media-ruler">
        {[0, 0.25, 0.5, 0.75, 1].map((x) => (
          <span key={x}>{stamp(viewStart + length * x)}</span>
        ))}
      </div>
      {zoom > 1 && (
        <label className="timeline-pan">
          Timeline position
          <input
            type="range"
            aria-label="Pan timeline"
            min="0"
            max={duration - length}
            step="0.001"
            value={viewStart}
            onChange={(e) => setOffset(Number(e.target.value))}
          />
        </label>
      )}
      {fade && (
        <label className="fade-control">
          Fade duration
          <input
            type="range"
            aria-label="Fade duration"
            min="0.1"
            max={Math.max(0.1, Math.min(120, duration))}
            step="0.1"
            value={options.duration}
            onChange={(e) =>
              onChange({ ...options, duration: Number(e.target.value) })
            }
          />
          <small>
            The envelope applies to the created result. This player uses the
            original recording.
          </small>
        </label>
      )}
      {tool && (
        <p className="media-note">
          {trim
            ? "Create result exports the selected interval. Space: play/pause · arrows: step · I/O: set bounds."
            : capture
              ? "Scrub or step to the frame you want to extract."
              : "Create result to hear or see the processed version."}
        </p>
      )}
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </section>
  );
}
export function MediaResults({ job, api }) {
  const [open, setOpen] = useState("");
  const files = (job.outputs || []).filter((p) =>
    /\.(wav|mp3|flac|m4a|aac|opus|ogg|mp4|webm|mov|mkv)$/i.test(p),
  );
  return files.length ? (
    <div className="media-results">
      {files.map((file) => (
        <div key={file}>
          <button
            className="text-button"
            onClick={() => setOpen(open === file ? "" : file)}
          >
            {open === file ? "Hide player" : "Play result"} ·{" "}
            {file.split(/[\\/]/).pop()}
          </button>
          {open === file && <MediaTimeline file={file} api={api} />}
        </div>
      ))}
    </div>
  ) : null;
}
