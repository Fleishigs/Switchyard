import React, { useEffect, useState } from "react";

export default function ImageComparison({ job, api }) {
  const [open, setOpen] = useState(false),
    [images, setImages] = useState(null),
    [error, setError] = useState(""),
    [position, setPosition] = useState(50);
  const before = job.inputs?.[0],
    after = job.outputs?.[0];
  useEffect(() => {
    if (!open || !before || !after) return;
    let active = true;
    setError("");
    setImages(null);
    Promise.all([api.preview(before), api.preview(after)])
      .then((value) => {
        if (active) setImages(value);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [open, before, after, api]);
  if (
    !before ||
    !after ||
    !job.toolId.startsWith("image-") ||
    !/\.(png|jpe?g|webp|avif)$/i.test(after)
  )
    return null;
  const sameSize =
    images &&
    Math.abs(
      images[0].width / images[0].height - images[1].width / images[1].height,
    ) < 0.001;
  return (
    <div className="image-comparison">
      <button
        className="secondary"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? "Hide comparison" : "Compare before & after"}
      </button>
      {open && (
        <div className="comparison-content">
          {error ? (
            <p role="alert">Could not load the comparison: {error}</p>
          ) : !images ? (
            <p role="status">Loading original and result…</p>
          ) : (
            <>
              {sameSize ? (
                <>
                  <div
                    className="comparison-stage"
                    style={{
                      aspectRatio: `${images[0].width} / ${images[0].height}`,
                      width: `min(100%, ${(480 * images[0].width) / images[0].height}px)`,
                    }}
                  >
                    <img src={images[0].url} alt="Original image" />
                    <img
                      src={images[1].url}
                      alt="Processed image"
                      style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
                    />
                    <span
                      className="comparison-divider"
                      style={{ left: `${position}%` }}
                    />
                  </div>
                  <div className="comparison-labels">
                    <span>Result</span>
                    <span>Original</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={position}
                    aria-label="Reveal processed image"
                    onChange={(e) => setPosition(Number(e.target.value))}
                  />
                </>
              ) : (
                <div className="comparison-pair">
                  {images.map((im, i) => (
                    <figure key={i}>
                      <img
                        src={im.url}
                        alt={i ? "Processed image" : "Original image"}
                      />
                      <figcaption>
                        {i ? "Result" : "Original"} · {im.width} × {im.height}
                      </figcaption>
                    </figure>
                  ))}
                </div>
              )}
              <p className="comparison-caption">
                {sameSize
                  ? `${images[1].width} × ${images[1].height} pixels · Drag the slider to compare.`
                  : "Previews fit their panels. The saved files retain the dimensions shown."}{" "}
                {job.toolId === "image-enhance"
                  ? "Contrast and edge detail adjustment; this does not reconstruct blurred detail."
                  : ""}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
