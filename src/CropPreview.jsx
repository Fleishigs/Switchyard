import { useRef } from "react";
export default function CropPreview({ preview, options, onChange }) {
  const drag = useRef(null),
    area = useRef(null);
  const { width, height, url } = preview;
  function point(event) {
    const r = area.current.getBoundingClientRect();
    return {
      x: Math.max(
        0,
        Math.min(
          width - 1,
          Math.round(((event.clientX - r.left) / r.width) * width),
        ),
      ),
      y: Math.max(
        0,
        Math.min(
          height - 1,
          Math.round(((event.clientY - r.top) / r.height) * height),
        ),
      ),
    };
  }
  function move(event) {
    if (!drag.current) return;
    const p = point(event),
      a = drag.current;
    onChange({
      ...options,
      left: Math.min(a.x, p.x),
      top: Math.min(a.y, p.y),
      width: Math.max(1, Math.abs(p.x - a.x)),
      height: Math.max(1, Math.abs(p.y - a.y)),
    });
  }
  function preset(ratio) {
    const w = Math.round(Math.min(width, height * ratio)),
      h = Math.round(w / ratio);
    onChange({
      ...options,
      left: Math.floor((width - w) / 2),
      top: Math.floor((height - h) / 2),
      width: w,
      height: h,
    });
  }
  return (
    <div className="crop-workspace">
      <div className="crop-presets">
        <span>Drag to select a crop</span>
        {[
          [1, "Square"],
          [16 / 9, "16:9"],
          [4 / 3, "4:3"],
        ].map(([r, name]) => (
          <button key={name} className="secondary" onClick={() => preset(r)}>
            {name}
          </button>
        ))}
      </div>
      <div className="crop-stage">
        <div
          ref={area}
          className="crop-image"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            drag.current = point(e);
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={move}
          onPointerUp={(e) => {
            move(e);
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <img
            src={url}
            alt="Drag over this image to select your crop"
            draggable={false}
          />
          <div
            className="crop-selection"
            style={{
              left: `${(options.left / width) * 100}%`,
              top: `${(options.top / height) * 100}%`,
              width: `${(Math.min(options.width, width - options.left) / width) * 100}%`,
              height: `${(Math.min(options.height, height - options.top) / height) * 100}%`,
            }}
          >
            <span />
            <span />
          </div>
        </div>
      </div>
      <small>
        Source: {width} × {height} pixels. You can also enter exact coordinates
        below.
      </small>
    </div>
  );
}
