import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  auditLogApi,
  type AuditStatsBucket,
  type AuditStatsDay,
} from "@/api";
import { getActionLabel } from "@/components/audit/auditActions";

type RangeKey = "7" | "30" | "90" | "all";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "7", label: "Last 7 days" },
  { key: "30", label: "Last 30 days" },
  { key: "90", label: "Last 90 days" },
  { key: "all", label: "All time" },
];

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: "#10b981",
  FAILURE: "#ef4444",
  PARTIAL: "#f59e0b",
};

function toIsoDate(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function rangeFor(key: RangeKey) {
  if (key === "all") {
    return { fromDate: undefined, toDate: undefined };
  }

  const to = new Date();
  const from = new Date();
  from.setDate(to.getDate() - (Number(key) - 1));

  return { fromDate: toIsoDate(from), toDate: toIsoDate(to) };
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-800">{title}</h3>
      {children}
    </section>
  );
}

function DailyChart({ days }: { days: AuditStatsDay[] }) {
  const width = 640;
  const height = 220;
  const margin = { top: 12, right: 8, bottom: 28, left: 32 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const max = Math.max(1, ...days.map((day) => day.total));
  const slot = days.length > 0 ? plotWidth / days.length : plotWidth;
  const barWidth = Math.max(2, slot * 0.7);
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  if (days.length === 0) {
    return <p className="py-8 text-center text-sm text-slate-400">No data in this period.</p>;
  }

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-56 w-full" role="img" aria-label="Events per day">
      {[0, 0.5, 1].map((fraction) => {
        const y = margin.top + plotHeight * (1 - fraction);
        return (
          <g key={fraction}>
            <line x1={margin.left} x2={width - margin.right} y1={y} y2={y} stroke="#e2e8f0" />
            <text x={margin.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="#94a3b8">
              {Math.round(max * fraction)}
            </text>
          </g>
        );
      })}

      {days.map((day, index) => {
        const x = margin.left + slot * index + (slot - barWidth) / 2;
        const totalHeight = (day.total / max) * plotHeight;
        const failureHeight = (day.failures / max) * plotHeight;
        const baseY = margin.top + plotHeight;

        return (
          <g key={day.date}>
            <title>{`${day.date}: ${day.total} events, ${day.failures} failures`}</title>
            <rect x={x} y={baseY - totalHeight} width={barWidth} height={totalHeight} rx="2" fill="#3b82f6" />
            {day.failures > 0 && (
              <rect x={x} y={baseY - failureHeight} width={barWidth} height={failureHeight} rx="2" fill="#ef4444" />
            )}
            {index % labelEvery === 0 && (
              <text x={x + barWidth / 2} y={height - 10} textAnchor="middle" fontSize="10" fill="#64748b">
                {day.date.slice(8, 10)}/{day.date.slice(5, 7)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

function BarList({
  items,
  label = (key: string) => key,
}: {
  items: AuditStatsBucket[];
  label?: (key: string) => string;
}) {
  const max = Math.max(1, ...items.map((item) => item.count));

  if (items.length === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No data.</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((item) => (
        <li key={item.key} className="text-sm">
          <div className="mb-1 flex justify-between gap-2">
            <span className="truncate text-slate-700">{label(item.key)}</span>
            <span className="font-medium text-slate-900">{item.count}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className="h-2 rounded-full bg-blue-500"
              style={{ width: `${(item.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

function ResultDonut({ items, total }: { items: AuditStatsBucket[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  if (total === 0) {
    return <p className="py-4 text-center text-sm text-slate-400">No data.</p>;
  }

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="h-32 w-32 shrink-0" role="img" aria-label="Results">
        <g transform="rotate(-90 60 60)">
          {items.map((item) => {
            const length = (item.count / total) * circumference;
            const segment = (
              <circle
                key={item.key}
                cx="60"
                cy="60"
                r={radius}
                fill="none"
                stroke={RESULT_COLORS[item.key] ?? "#94a3b8"}
                strokeWidth="16"
                strokeDasharray={`${length} ${circumference - length}`}
                strokeDashoffset={-offset}
              />
            );
            offset += length;
            return segment;
          })}
        </g>
        <text x="60" y="64" textAnchor="middle" fontSize="16" fontWeight="600" fill="#0f172a">
          {total}
        </text>
      </svg>

      <ul className="space-y-1.5 text-sm">
        {items.map((item) => (
          <li key={item.key} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: RESULT_COLORS[item.key] ?? "#94a3b8" }}
            />
            <span className="text-slate-700">{item.key}</span>
            <span className="font-medium text-slate-900">{item.count}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Statistics of the audit log: volume over time, most used actions, entities, actors and results.
 */
export function AuditStatsDashboard() {
  const [range, setRange] = useState<RangeKey>("30");

  const query = useQuery({
    queryKey: ["audit-stats", range],
    queryFn: () => auditLogApi.getStats(rangeFor(range)),
    staleTime: 30_000,
  });

  const stats = query.data;
  const successRate =
    stats && stats.total > 0
      ? `${Math.round(((stats.total - stats.failures) / stats.total) * 100)}%`
      : "-";
  const activeDays = stats ? stats.byDay.filter((day) => day.total > 0).length : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {stats ? `${stats.fromDate} to ${stats.toDate}` : "Loading statistics..."}
        </p>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setRange(item.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                range === item.key
                  ? "bg-blue-600 text-white"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {query.isError && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          Unable to load statistics.
        </p>
      )}

      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="Total events" value={String(stats.total)} />
            <KpiCard label="Failures" value={String(stats.failures)} />
            <KpiCard label="Success rate" value={successRate} />
            <KpiCard label="Active days" value={String(activeDays)} hint="days with at least one event" />
          </div>

          <Panel title="Events per day (red = failures)">
            <DailyChart days={stats.byDay} />
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Actions">
              <BarList items={stats.byAction} label={getActionLabel} />
            </Panel>
            <Panel title="Entities">
              <BarList items={stats.byEntityType} />
            </Panel>
            <Panel title="Results">
              <ResultDonut items={stats.byResult} total={stats.total} />
            </Panel>
            <Panel title="Most active users">
              <BarList items={stats.topActors} />
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}

export default AuditStatsDashboard;
