import { useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CalendarDays, CheckCircle2, Info } from "lucide-react";
import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";
import {
    auditLogApi,
    type AuditStatsBucket,
    type AuditStatsDay,
    type AuditStatsEntityAction,
} from "@/api";
import { getActionLabel } from "@/components/audit/auditActions";

const PRIMARY = "#6366f1";
const DANGER = "#ef4444";
const TOOLTIP_STYLE = {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--card-foreground)",
    fontSize: 12,
} as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const RESULT_META: Record<string, { label: string; color: string }> = {
    SUCCESS: { label: "Passed", color: PRIMARY },
    FAILURE: { label: "Rejected", color: DANGER },
    PARTIAL: { label: "Partial", color: "#f59e0b" },
};

/** Actions are grouped so each entity row stays readable; an unlisted action falls into "Update". */
const GROUPS = [
    { key: "create", label: "Create", color: PRIMARY, actions: ["CREATE", "REGISTER", "ACCEPT", "ACTIVATE", "CONFIRM", "RESOLVE"] },
    { key: "update", label: "Update / Add", color: "#38bdf8", actions: [] },
    { key: "remove", label: "Delete / Reject", color: DANGER, actions: ["DELETE", "REJECT", "REVOKE", "CANCEL", "REMOVE_QUESTION", "UNLINK", "UNPUBLISH"] },
    { key: "auth", label: "Auth / Session", color: "#64748b", actions: ["LOGIN", "LOGOUT", "VERIFY_EMAIL", "FORGOT_PASSWORD", "RESET_PASSWORD"] },
    { key: "link", label: "Link / Invite", color: "#14b8a6", actions: ["LINK", "INVITE", "BATCH_INVITE", "RESEND", "ADD_QUESTION"] },
] as const;

const ACTION_GROUP = new Map<string, string>(
    GROUPS.flatMap((group) => group.actions.map((action) => [action, group.key] as const)),
);

const groupOf = (action: string) => ACTION_GROUP.get(action.toUpperCase()) ?? "update";

function formatDay(date: string) {
    const month = MONTHS[Number(date.slice(5, 7)) - 1] ?? "";
    return `${date.slice(8, 10)} ${month}`;
}

function daysBetween(from: string, to: string, fallback: number) {
    const span = Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1;
    return Number.isFinite(span) && span > 0 ? span : fallback;
}

function Badge({ children, tone }: { children: ReactNode; tone: "red" | "indigo" | "slate" }) {
    const styles = {
        red: "bg-red-500/10 text-red-600 dark:text-red-400",
        indigo: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
        slate: "bg-muted text-muted-foreground",
    };
    return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${styles[tone]}`}>{children}</span>;
}

function KpiCard({
                     label,
                     value,
                     hint,
                     badge,
                     icon: Icon,
                     tone,
                 }: {
    label: string;
    value: string;
    hint?: string;
    badge?: ReactNode;
    icon: typeof Activity;
    tone: string;
}) {
    return (
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        </span>
            </div>
            <div className="mt-2 flex items-baseline gap-2">
                <p className="text-3xl font-semibold text-foreground">{value}</p>
                {badge}
            </div>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

function Panel({
                   title,
                   subtitle,
                   action,
                   children,
                   footer,
               }: {
    title: string;
    subtitle?: string;
    action?: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <section className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-foreground">{title}</h3>
                    {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                {action}
            </div>
            {children}
            {footer && <div className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{footer}</div>}
        </section>
    );
}

function Empty({ text = "No data in this period." }: { text?: string }) {
    return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

function Timeline({ days, normalized }: { days: AuditStatsDay[]; normalized: boolean }) {
    const data = useMemo(
        () =>
            days.map((day) => ({
                date: day.date,
                label: formatDay(day.date),
                success: Math.max(0, day.total - day.failures),
                failure: day.failures,
            })),
        [days],
    );

    if (data.every((day) => day.success + day.failure === 0)) return <Empty />;

    return (
        <div className="h-72 w-full text-muted-foreground" role="img" aria-label="Events per day">
            <ResponsiveContainer width="100%" height="100%">
                <BarChart
                    data={data}
                    stackOffset={normalized ? "expand" : "none"}
                    margin={{ top: 8, right: 8, bottom: 0, left: -12 }}
                >
                    <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
                    <XAxis
                        dataKey="label"
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickLine={false}
                        axisLine={{ stroke: "currentColor", strokeOpacity: 0.2 }}
                        interval="preserveStartEnd"
                        minTickGap={24}
                    />
                    <YAxis
                        allowDecimals={false}
                        tick={{ fontSize: 11, fill: "currentColor" }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(value: number) => (normalized ? `${Math.round(value * 100)}%` : String(value))}
                    />
                    <Tooltip
                        cursor={{ fill: "currentColor", fillOpacity: 0.06 }}
                        contentStyle={TOOLTIP_STYLE}
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ""}
                        formatter={(value, name) => [String(value), name === "success" ? "Success" : "Failure"]}
                    />
                    <Bar dataKey="success" stackId="events" fill={PRIMARY} maxBarSize={40} />
                    <Bar dataKey="failure" stackId="events" fill={DANGER} maxBarSize={40} radius={[3, 3, 0, 0]} />
                </BarChart>
            </ResponsiveContainer>
        </div>
    );
}

const MAX_ENTITIES = 8;

function EntityDistribution({ items }: { items: AuditStatsEntityAction[] }) {
    const { rows, totalEntities } = useMemo(() => {
        const byEntity = new Map<string, { entityType: string; total: number; groups: Record<string, number>; actions: Record<string, number> }>();
        let grandTotal = 0;

        for (const item of items) {
            const row = byEntity.get(item.entityType) ?? { entityType: item.entityType, total: 0, groups: {}, actions: {} };
            const group = groupOf(item.action);
            row.groups[group] = (row.groups[group] ?? 0) + item.count;
            row.actions[item.action] = (row.actions[item.action] ?? 0) + item.count;
            row.total += item.count;
            grandTotal += item.count;
            byEntity.set(item.entityType, row);
        }

        const sorted = [...byEntity.values()].sort((a, b) => b.total - a.total);
        return {
            rows: sorted.slice(0, MAX_ENTITIES).map((row) => ({ ...row, share: grandTotal ? row.total / grandTotal : 0 })),
            totalEntities: sorted.length,
        };
    }, [items]);

    if (rows.length === 0) return <Empty text="No data." />;

    const widest = rows[0].total;

    return (
        <>
            <ul className="mb-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {GROUPS.map((group) => (
                    <li key={group.key} className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: group.color }} />
                        {group.label}
                    </li>
                ))}
            </ul>

            <ul className="space-y-3.5">
                {rows.map((row) => (
                    <li key={row.entityType}>
                        <div className="mb-1 flex items-baseline justify-between gap-3 text-xs">
                            <span className="truncate font-medium text-foreground">{row.entityType}</span>
                            <span className="shrink-0 text-muted-foreground">
                {row.total} events • {(row.share * 100).toFixed(1)}%
              </span>
                        </div>
                        <div
                            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
                            style={{ width: `${Math.max(8, (row.total / widest) * 100)}%` }}
                        >
                            {GROUPS.map((group) => {
                                const count = row.groups[group.key];
                                if (!count) return null;
                                const detail = Object.entries(row.actions)
                                    .filter(([action]) => groupOf(action) === group.key)
                                    .map(([action, n]) => `${getActionLabel(action)}: ${n}`)
                                    .join(", ");
                                return (
                                    <span
                                        key={group.key}
                                        title={`${group.label} (${count}) - ${detail}`}
                                        style={{ width: `${(count / row.total) * 100}%`, backgroundColor: group.color }}
                                    />
                                );
                            })}
                        </div>
                    </li>
                ))}
            </ul>

            <p className="mt-4 text-xs text-muted-foreground">
                Showing top {rows.length} of {totalEntities} entity types
            </p>
        </>
    );
}

function ExecutionSplit({ items, total }: { items: AuditStatsBucket[]; total: number }) {
    if (total === 0) return <Empty text="No data." />;

    const radius = 42;
    const circumference = 2 * Math.PI * radius;
    const segments = items.map((item, index) => ({
        item,
        length: (item.count / total) * circumference,
        start:
            items.slice(0, index).reduce((sum, previous) => sum + previous.count, 0) /
            total *
            circumference,
    }));

    return (
        <div className="flex items-center gap-5">
            <svg viewBox="0 0 120 120" className="h-28 w-28 shrink-0 text-foreground" role="img" aria-label="Execution split">
                <g transform="rotate(-90 60 60)">
                    {segments.map(({ item, length, start }) => (
                        <circle
                            key={item.key}
                            cx="60"
                            cy="60"
                            r={radius}
                            fill="none"
                            stroke={RESULT_META[item.key]?.color ?? "#94a3b8"}
                            strokeWidth="14"
                            strokeDasharray={`${length} ${circumference - length}`}
                            strokeDashoffset={-start}
                        />
                    ))}
                </g>
                <text x="60" y="58" textAnchor="middle" fontSize="20" fontWeight="600" fill="currentColor">
                    {total}
                </text>
                <text x="60" y="74" textAnchor="middle" fontSize="9" fill="currentColor" opacity={0.6}>
                    total
                </text>
            </svg>

            <ul className="space-y-2 text-sm">
                {items.map((item) => (
                    <li key={item.key} className="flex items-center gap-2">
            <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: RESULT_META[item.key]?.color ?? "#94a3b8" }}
            />
                        <span className="text-foreground/80">{RESULT_META[item.key]?.label ?? item.key}</span>
                        <span className="font-medium text-foreground">{item.count}</span>
                        <span className="text-xs text-muted-foreground">({((item.count / total) * 100).toFixed(1)}%)</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

function TopActors({ items, total }: { items: AuditStatsBucket[]; total: number }) {
    if (items.length === 0) return <Empty text="No data." />;

    return (
        <ul className="space-y-4">
            {items.slice(0, 5).map((item) => {
                const share = total > 0 ? (item.count / total) * 100 : 0;
                return (
                    <li key={item.key} className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 text-xs font-semibold text-indigo-600 dark:text-indigo-300">
              {item.key.slice(0, 2).toUpperCase()}
            </span>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2 text-sm">
                                <span className="truncate font-medium text-foreground">{item.key}</span>
                                <span className="shrink-0 text-xs text-muted-foreground">{item.count} ev</span>
                            </div>
                            <div className="mt-1.5 h-1.5 rounded-full bg-muted">
                                <div className="h-1.5 rounded-full" style={{ width: `${share}%`, backgroundColor: PRIMARY }} />
                            </div>
                            <p className="mt-1 text-[11px] text-muted-foreground">{share.toFixed(1)}% workload</p>
                        </div>
                    </li>
                );
            })}
        </ul>
    );
}

/**
 * Statistics of the audit log: volume over time, actions per entity, results and most active users.
 * The date range is owned by the page so the Logs and Statistics tabs always agree.
 */
export function AuditStatsDashboard({
                                        fromDate,
                                        toDate,
                                    }: {
    fromDate?: string;
    toDate?: string;
}) {
    const [normalized, setNormalized] = useState(false);

    const query = useQuery({
        queryKey: ["audit-stats", fromDate ?? null, toDate ?? null],
        queryFn: () => auditLogApi.getStats({ fromDate, toDate }),
        staleTime: 30_000,
    });

    const stats = query.data;

    const derived = useMemo(() => {
        if (!stats) return null;

        const successes = stats.total - stats.failures;
        const rangeDays = daysBetween(stats.fromDate, stats.toDate, stats.byDay.length);
        const activeDays = stats.byDay.filter((day) => day.total > 0).length;
        const peak = stats.byDay.reduce<AuditStatsDay | null>(
            (best, day) => (day.failures > (best?.failures ?? 0) ? day : best),
            null,
        );
        const density = rangeDays > 0 ? activeDays / rangeDays : 0;

        return {
            successes,
            rangeDays,
            activeDays,
            peak,
            averagePerDay: rangeDays > 0 ? stats.total / rangeDays : 0,
            failureShare: stats.total > 0 ? (stats.failures / stats.total) * 100 : 0,
            successRate: stats.total > 0 ? (successes / stats.total) * 100 : null,
            activity: density >= 0.6 ? "Dense" : density >= 0.25 ? "Steady" : "Sparse",
        };
    }, [stats]);

    return (
        <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
                {stats ? `${stats.fromDate} to ${stats.toDate}` : query.isError ? "" : "Loading statistics..."}
            </p>

            {query.isError && (
                <p className="rounded-lg bg-red-500/10 p-3 text-sm text-red-600 dark:text-red-400">Unable to load statistics. Reload the page or try a different date range.</p>
            )}

            {stats && derived && (
                <>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <KpiCard
                            label="Total event volume"
                            value={String(stats.total)}
                            hint={`${derived.averagePerDay.toFixed(1)} events per day on average`}
                            icon={Activity}
                            tone="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
                        />
                        <KpiCard
                            label="Denied / failures"
                            value={String(stats.failures)}
                            badge={<Badge tone="red">{derived.failureShare.toFixed(1)}% of total</Badge>}
                            hint={derived.peak ? `Peak on ${formatDay(derived.peak.date)} (${derived.peak.failures} failures)` : "No failures in this period"}
                            icon={AlertTriangle}
                            tone="bg-red-500/10 text-red-600 dark:text-red-400"
                        />
                        <KpiCard
                            label="Policy pass rate"
                            value={derived.successRate === null ? "-" : `${derived.successRate.toFixed(1)}%`}
                            hint={`${derived.successes} of ${stats.total} events passed`}
                            icon={CheckCircle2}
                            tone="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        />
                        <KpiCard
                            label="Activity window"
                            value={`${derived.activeDays} ${derived.activeDays === 1 ? "day" : "days"}`}
                            badge={<Badge tone="slate">{derived.activity}</Badge>}
                            hint={`out of ${derived.rangeDays} days in range`}
                            icon={CalendarDays}
                            tone="bg-violet-500/10 text-violet-600 dark:text-violet-400"
                        />
                    </div>

                    <Panel
                        title="Audit events timeline"
                        subtitle="Successful events compared with denied or failed ones, per day."
                        action={
                            <div className="flex flex-wrap items-center gap-4">
                                <ul className="flex items-center gap-3 text-xs text-muted-foreground">
                                    <li className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: PRIMARY }} />
                                        Success ({derived.successes})
                                    </li>
                                    <li className="flex items-center gap-1.5">
                                        <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: DANGER }} />
                                        Failure ({stats.failures})
                                    </li>
                                </ul>
                                <div className="flex rounded-lg border border-border p-0.5 text-xs" role="group" aria-label="Chart scale">
                                    {[
                                        { label: "Stacked", value: false },
                                        { label: "Normalized", value: true },
                                    ].map((option) => (
                                        <button
                                            key={option.label}
                                            type="button"
                                            aria-pressed={normalized === option.value}
                                            onClick={() => setNormalized(option.value)}
                                            className={`rounded-md px-2.5 py-1 font-medium ${
                                                normalized === option.value ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300" : "text-muted-foreground hover:text-foreground/80"
                                            }`}
                                        >
                                            {option.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        }
                        footer={
                            <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5" aria-hidden="true" />
                Success and failure are taken from the result recorded with each audit event.
              </span>
                        }
                    >
                        <Timeline days={stats.byDay} normalized={normalized} />
                    </Panel>

                    <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                        <Panel title="Actions distributed by entity" subtitle="Audit operations grouped by the kind of change.">
                            <EntityDistribution items={stats.byEntityAction ?? []} />
                        </Panel>

                        <div className="space-y-4">
                            <Panel title="Execution split">
                                <ExecutionSplit items={stats.byResult} total={stats.total} />
                            </Panel>

                            <Panel title="Most active actors" subtitle="Top initiators of tracked changes.">
                                <TopActors items={stats.topActors} total={stats.total} />
                            </Panel>

                            {derived.peak && (
                                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                                    <p className="font-medium">Failures peaked on {formatDay(derived.peak.date)}</p>
                                    <p className="mt-1 text-xs">
                                        {derived.peak.failures} of {stats.failures} failed events ({Math.round((derived.peak.failures / stats.failures) * 100)}%) happened that day. Filter the Logs tab by Failure to see the cause.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
