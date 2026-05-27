"use client";

import { CloseIconButton } from "@/components/ui/CloseIconButton";
import { formatDisplayDate } from "@/core/date-display";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { useEffect, useRef, useState } from "react";

export type DateRangePreset = "all" | "today" | "yesterday" | "week" | "thisMonth" | "lastMonth" | "custom";

export function DateRangeControls({
  customRange,
  onRangeChange,
  calendarZIndex = 100,
  compact = false,
}: {
  customRange: DateRange | undefined;
  onRangeChange: (range: DateRange | undefined) => void;
  calendarZIndex?: number;
  compact?: boolean;
}) {
  const [draftRange, setDraftRange] = useState<DateRange | undefined>();
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date | undefined>(undefined);
  const [presetOpen, setPresetOpen] = useState(false);
  const presetRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!calendarOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setCalendarOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [calendarOpen]);

  useEffect(() => {
    if (!presetOpen) return;
    function onMouseDown(e: MouseEvent) {
      if (!presetRef.current) return;
      if (!presetRef.current.contains(e.target as Node)) {
        setPresetOpen(false);
      }
    }
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [presetOpen]);

  const applyPreset = (preset: DateRangePreset) => {
    if (preset === "all") {
      onRangeChange(undefined);
      setDraftRange(undefined);
      setPresetOpen(false);
      return;
    }
    if (preset === "custom") {
      setDraftRange(customRange);
      setCalendarMonth(customRange?.from ?? new Date());
      setCalendarOpen(true);
      setPresetOpen(false);
      return;
    }
    const range = getPresetRange(preset);
    onRangeChange(range);
    setDraftRange(range);
    setPresetOpen(false);
  };

  const dateLabel = customRange?.from
    ? `${formatDisplayDate(customRange.from)}${customRange?.to ? ` → ${formatDisplayDate(customRange.to)}` : ""}`
    : "All Date";

  return (
    <>
      <div className={`flex flex-wrap items-center gap-2 ${compact ? "justify-end" : ""}`}>
        <div className="relative" ref={presetRef}>
          <button
            type="button"
            className={`rounded-xl border border-[#E5DED3] bg-white px-3 text-left text-sm text-[#2A2A2A] shadow-sm outline-none transition hover:bg-[#FAF7F2] ${
              compact ? "w-52 py-2" : "w-64 py-2.5"
            }`}
            onClick={() => setPresetOpen((prev) => !prev)}
          >
            {dateLabel}
          </button>
          {presetOpen ? (
            <div
              className={`absolute z-20 mt-2 rounded-xl border border-[#E5DED3] bg-white p-1.5 shadow-[0_10px_30px_rgba(21,21,21,0.12)] ${
                compact ? "right-0 w-52" : "w-64"
              }`}
            >
              <PresetItem label="All Date" onClick={() => applyPreset("all")} />
              <PresetItem label="Today" onClick={() => applyPreset("today")} />
              <PresetItem label="Yesterday" onClick={() => applyPreset("yesterday")} />
              <PresetItem label="One Week" onClick={() => applyPreset("week")} />
              <PresetItem label="This Month" onClick={() => applyPreset("thisMonth")} />
              <PresetItem label="Last Month" onClick={() => applyPreset("lastMonth")} />
              <PresetItem label="Custom" onClick={() => applyPreset("custom")} />
            </div>
          ) : null}
        </div>
      </div>
      {calendarOpen ? (
        <div
          className="fixed inset-0 flex items-center justify-center bg-ink/30 p-4"
          style={{ zIndex: calendarZIndex }}
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setCalendarOpen(false);
          }}
        >
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl border border-[#E5DED3] bg-white p-0 shadow-[0_4px_10px_rgba(21,21,21,0.08),0_22px_50px_rgba(21,21,21,0.08)]">
            <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E5DED3] bg-white p-4">
              <div>
                <p className="text-base font-semibold text-[#2A2A2A]">Select date range</p>
                <p className="mt-1 text-xs text-[#8D8376]">
                  {draftRange?.from ? formatDisplayDate(draftRange.from) : "—"} →{" "}
                  {draftRange?.to ? formatDisplayDate(draftRange.to) : "—"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <CloseIconButton ariaLabel="Close calendar" onClick={() => setCalendarOpen(false)} />
                {draftRange?.from && draftRange?.to ? (
                  <button
                    type="button"
                    className="inline-flex items-center rounded-xl bg-[#C8B693] px-4 py-2 text-sm font-medium text-[#2A2A2A] transition hover:brightness-95"
                    onClick={() => {
                      onRangeChange(draftRange);
                      setCalendarOpen(false);
                    }}
                  >
                    Done
                  </button>
                ) : null}
              </div>
            </div>
            <div className="max-h-[80vh] overflow-auto p-5">
              <p className="rounded-lg bg-[#F8F5EF] px-3 py-2 text-xs text-[#7A6F61]">
                {!draftRange?.from
                  ? "Step 1: Select From date."
                  : !draftRange?.to
                    ? "Step 2: Select To date."
                    : "Step 3: Click Done to apply range."}
              </p>
              <div className="mt-4 flex justify-center rounded-2xl border border-[#E5DED3] bg-[#FBF9F5] p-4">
                <DayPicker
                  mode="range"
                  numberOfMonths={2}
                  month={calendarMonth}
                  onMonthChange={setCalendarMonth}
                  selected={draftRange}
                  onSelect={setDraftRange}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function getPresetRange(preset: "today" | "yesterday" | "week" | "thisMonth" | "lastMonth"): DateRange {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (preset === "today") return { from: today, to: today };
  if (preset === "yesterday") {
    const y = new Date(today);
    y.setDate(y.getDate() - 1);
    return { from: y, to: y };
  }
  if (preset === "week") {
    const start = new Date(today);
    start.setDate(start.getDate() - 6);
    return { from: start, to: today };
  }
  if (preset === "thisMonth") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return { from: start, to: end };
  }
  const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const end = new Date(today.getFullYear(), today.getMonth(), 0);
  return { from: start, to: end };
}

function PresetItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-lg px-3 py-2 text-left text-sm text-[#3C352D] transition hover:bg-[#F8F5EF]"
    >
      {label}
    </button>
  );
}
