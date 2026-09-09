import React, { useEffect, useState, useRef } from "react";
export default function NumberField({ value, onChange, ...props }) {
  const cancel = useRef(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(String(value ?? ""));
  }, [value, editing]);
  function commit() {
    const number = Number(draft);
    if (!cancel.current && draft.trim() && Number.isFinite(number))
      onChange(number);
    else setDraft(String(value ?? ""));
    cancel.current = false;
    setEditing(false);
  }
  return (
    <input
      {...props}
      type="number"
      step="any"
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          e.currentTarget.blur();
        }
        if (e.key === "Escape") {
          e.stopPropagation();
          cancel.current = true;
          setDraft(String(value ?? ""));
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
    />
  );
}
