"use client";

type Point = { label: string; value: number };

export function CashFlowBarChart({
  rows,
  mode = "both",
}: {
  rows: { label: string; incoming: number; outgoing: number }[];
  mode?: "both" | "incoming" | "outgoing";
}) {
  if (!rows.length) {
    return <p className="mt-4 text-sm text-[#9CA3AF]">No cash flow data for this period.</p>;
  }
  const max = Math.max(1, ...rows.flatMap((r) => [r.incoming, r.outgoing]));

  return (
    <div className="mt-4 flex h-52 items-end gap-1.5 overflow-x-auto sm:gap-2">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-10 flex-1 flex-col items-center gap-2">
          <div className="flex h-40 items-end gap-0.5">
            {mode !== "outgoing" ? (
              <div
                className="w-2 rounded-full bg-[#3B82F6]"
                style={{ height: `${Math.max((row.incoming / max) * 140, 6)}px` }}
                title={`Incoming ${row.incoming}`}
              />
            ) : null}
            {mode !== "incoming" ? (
              <div
                className="w-2 rounded-full bg-[#10B981]"
                style={{ height: `${Math.max((row.outgoing / max) * 140, 6)}px` }}
                title={`Outgoing ${row.outgoing}`}
              />
            ) : null}
          </div>
          <span className="max-w-full truncate text-[10px] text-[#6B7280]">{row.label}</span>
        </div>
      ))}
    </div>
  );
}

export function ProfitBarTrend({ rows }: { rows: Point[] }) {
  if (!rows.length) return <p className="text-sm text-[#9CA3AF]">No profit trend data.</p>;
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 1);

  return (
    <div className="flex h-32 items-end gap-2">
      {rows.map((row) => {
        const h = Math.max(8, (Math.abs(row.value) / max) * 110);
        const positive = row.value >= 0;
        return (
          <div key={row.label} className="flex flex-1 flex-col items-center gap-1">
            <div
              className={`w-full max-w-[28px] rounded-t-md ${positive ? "bg-[#3B82F6]" : "bg-[#EF4444]"}`}
              style={{ height: `${h}px` }}
            />
            <span className="truncate text-[10px] text-[#9CA3AF]">{row.label.slice(0, 3)}</span>
          </div>
        );
      })}
    </div>
  );
}

export function DonutChart({
  segments,
  size = 160,
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  let cursor = 0;
  const stops = segments
    .map((seg) => {
      const deg = (seg.value / total) * 360;
      const start = cursor;
      cursor += deg;
      return `${seg.color} ${start}deg ${cursor}deg`;
    })
    .join(", ");

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
      <div
        className="rounded-full"
        style={{
          width: size,
          height: size,
          background: `conic-gradient(${stops})`,
          boxShadow: "inset 0 0 0 28px white",
        }}
      />
      <ul className="space-y-2 text-sm">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2 text-[#374151]">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: seg.color }} />
            <span>{seg.label}</span>
            <span className="ml-auto tabular-nums font-medium">{((seg.value / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
