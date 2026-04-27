"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Option = {
  value: string;
  label: string;
};

export function AppSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  className = "",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? placeholder,
    [options, placeholder, value],
  );

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  return (
    <div className={`relative ${className}`} ref={ref}>
      <button
        type="button"
        disabled={disabled}
        className="input-base mt-1 flex w-full items-center justify-between text-left disabled:opacity-60"
        onClick={() => setOpen((v) => !v)}
      >
        <span className={value ? "text-ink" : "text-muted"}>{selectedLabel}</span>
        <span className="text-xs text-[#7E7569]">▼</span>
      </button>
      {open ? (
        <div className="absolute z-30 mt-2 w-full rounded-xl border border-[#E5DED3] bg-white p-1.5 shadow-[0_10px_30px_rgba(21,21,21,0.12)]">
          {options.map((opt) => (
            <button
              key={opt.value || "__empty"}
              type="button"
              className={`block w-full rounded-lg px-3 py-2 text-left text-sm transition hover:bg-[#F8F5EF] ${
                value === opt.value ? "bg-[#F3EDE3] text-[#2A2A2A]" : "text-[#3C352D]"
              }`}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
