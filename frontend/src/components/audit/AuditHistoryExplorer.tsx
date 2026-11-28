import { useEffect, useMemo, useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, History } from "lucide-react";
import { auditLogApi, type AuditLogDTO } from "@/api";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    getActionBadgeClass,
    getActionDotClass,
    getActionLabel,
} from "@/components/audit/auditActions";

/**
 * What the explorer is looking at:
 * - entityId === null -> every event of one object type (AUTH, COURSE...)
 * - entityId set      -> the full history of one record of that type
 */
export interface AuditHistoryScope {
    entityType: string;
    entityId: string | null;
    /** Action filter to start with (only used when the explorer opens on an object type). */
    action?: string;
}

interface AuditHistoryExplorerProps {
    initialScope: AuditHistoryScope;
    onClose: () => void;
}

type Period = "all" | "7" | "30";
type ResultFilter = "" | "SUCCESS" | "FAILURE";

type Detail =
    | { kind: "changes"; rows: { key: string; from: string; to: string }[] }
    | { kind: "snapshot"; label: string; rows: { key: string; value: string }[] }
    | { kind: "none" };

const PAGE_SIZE = 15;
const MAX_VALUE_LENGTH = 160;
const IGNORED_FIELDS = new Set(["updatedAt", "updatedBy", "version"]);

const PERIODS: { key: Period; label: string }[] = [
    { key: "all", label: "All time" },
    { key: "30", label: "Last 30 days" },
    { key: "7", label: "Last 7 days" },
];

const RESULTS: { key: ResultFilter; label: string }[] = [
    { key: "", label: "All" },
    { key: "SUCCESS", label: "Success" },
    { key: "FAILURE", label: "Failures" },
];

function useDebouncedValue<T>(value: T, delay = 400): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
}

function toIsoDate(date: Date) {
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${month}-${day}`;
}

function periodRange(period: Period): { fromDate?: string; toDate?: string } {
    if (period === "all") return {};

    const days = period === "7" ? 7 : 30;
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - (days - 1));

    return { fromDate: toIsoDate(start), toDate: toIsoDate(end) };
}

function parseObject(value: string | null): Record<string, unknown> | null {
    if (!value) return null;

    try {
        const parsed: unknown = JSON.parse(value);

        return parsed && typeof parsed === "object" && !Array.isArray(parsed)
            ? (parsed as Record<string, unknown>)
            : null;
    } catch {
        return null;
    }
}

function displayValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "—";

    const text = typeof value === "object" ? JSON.stringify(value) : String(value);

    return text.length > MAX_VALUE_LENGTH
        ? `${text.slice(0, MAX_VALUE_LENGTH)}…`
        : text;
}

/** What to show when an event is expanded: field changes, a snapshot, or nothing. */
function buildDetail(log: AuditLogDTO): Detail {
    const before = parseObject(log.oldValue);
    const after = parseObject(log.newValue);

    if (before && after) {
        const keys = Array.from(
            new Set([...Object.keys(before), ...Object.keys(after)]),
        );

        return {
            kind: "changes",
            rows: keys
                .filter((key) => !IGNORED_FIELDS.has(key))
                .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
                .map((key) => ({
                    key,
                    from: displayValue(before[key]),
                    to: displayValue(after[key]),
                })),
        };
    }

    const snapshot = after ?? before;

    if (snapshot) {
        return {
            kind: "snapshot",
            label: after ? "Values recorded" : "Values before it was removed",
            rows: Object.entries(snapshot)
                .filter(([key]) => !IGNORED_FIELDS.has(key))
                .map(([key, value]) => ({ key, value: displayValue(value) })),
        };
    }

    return { kind: "none" };
}

function formatTime(value: string) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return value;

    return date.toLocaleString("vi-VN", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });
}

function isFailure(result: string | null) {
    return ["FAIL", "FAILED", "FAILURE"].includes((result ?? "").trim().toUpperCase());
}

function initialsOf(email: string | null | undefined) {
    const name = (email ?? "")
        .split("@")[0]
        .replace(/[^a-zA-Z0-9]/g, " ")
        .trim();

    if (!name) return "?";

    const parts = name.split(/\s+/);

    return (
        parts.length > 1 ? parts[0][0] + parts[1][0] : name.slice(0, 2)
    ).toUpperCase();
}

function Avatar({ email }: { email: string | null | undefined }) {
    return (
        <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500/15 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300"
        >
      {initialsOf(email)}
    </span>
    );
}

function ActionPill({ action }: { action: string }) {
    return (
        <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${getActionBadgeClass(
                action,
            )}`}
        >
      <span
          aria-hidden="true"
          className={`h-1.5 w-1.5 rounded-full ${getActionDotClass(action)}`}
      />
            {getActionLabel(action)}
    </span>
    );
}

function Chip({
                  active,
                  onClick,
                  children,
              }: {
    active: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition ${
                active
                    ? "border-indigo-500 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground/80"
            }`}
        >
            {children}
        </button>
    );
}

function CopyValue({ label, value }: { label: string; value: string }) {
    const [copied, setCopied] = useState(false);

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // clipboard is not available (e.g. insecure context): nothing to do
        }
    };

    return (
        <span className="inline-flex items-center gap-1.5">
      <span>{label}</span>
      <button
          type="button"
          onClick={copy}
          title="Copy"
          className="break-all font-mono text-foreground/80 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        {copied ? "Copied" : value}
      </button>
    </span>
    );
}

function HistoryEvent({
                          log,
                          showObject,
                          expanded,
                          onToggle,
                          onOpenRecord,
                          onFilterActor,
                      }: {
    log: AuditLogDTO;
    showObject: boolean;
    expanded: boolean;
    onToggle: () => void;
    onOpenRecord: (entityId: string) => void;
    onFilterActor?: (email: string) => void;
}) {
    const detail = expanded ? buildDetail(log) : null;
    const actor = (
        <>
            <Avatar email={log.actorEmail} />
            <span className="truncate">{log.actorEmail || "Unknown actor"}</span>
        </>
    );

    return (
        <li className="rounded-lg border border-border bg-card">
            <div
                onClick={onToggle}
                className="flex cursor-pointer flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-3 py-2.5 hover:bg-muted/40"
            >
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Hide details" : "Show details"}
                    onClick={(event) => {
                        event.stopPropagation();
                        onToggle();
                    }}
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                >
                    {expanded ? (
                        <ChevronDown className="h-4 w-4" aria-hidden="true" />
                    ) : (
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    )}
                </button>

                <span className="whitespace-nowrap text-xs text-muted-foreground">
          {formatTime(log.createdAt)}
        </span>

                <ActionPill action={log.action} />

                {isFailure(log.result) && (
                    <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-500">
            Failed
          </span>
                )}

                {onFilterActor && log.actorEmail ? (
                    <button
                        type="button"
                        title="Show only this actor"
                        onClick={(event) => {
                            event.stopPropagation();
                            onFilterActor(log.actorEmail as string);
                        }}
                        className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground hover:text-indigo-600 dark:hover:text-indigo-400"
                    >
                        {actor}
                    </button>
                ) : (
                    <span className="inline-flex min-w-0 items-center gap-2 text-sm text-foreground">
            {actor}
          </span>
                )}

                {showObject && log.entityId && (
                    <button
                        type="button"
                        title="Open the history of this record"
                        onClick={(event) => {
                            event.stopPropagation();
                            onOpenRecord(String(log.entityId));
                        }}
                        className="ml-auto rounded-md border border-border px-2 py-0.5 font-mono text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                        #{log.entityId}
                    </button>
                )}
            </div>

            {detail && (
                <div className="space-y-3 border-t border-border px-4 py-3 text-xs">
                    {detail.kind === "changes" &&
                        (detail.rows.length > 0 ? (
                            <ul className="divide-y divide-border rounded-md border border-border">
                                {detail.rows.map((row) => (
                                    <li key={row.key} className="space-y-0.5 px-3 py-2">
                                        <div className="font-semibold text-foreground">{row.key}</div>
                                        <div className="break-words font-mono text-red-600 dark:text-red-400">
                                            − {row.from}
                                        </div>
                                        <div className="break-words font-mono text-emerald-600 dark:text-emerald-400">
                                            + {row.to}
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground">
                                No field-level changes were captured.
                            </p>
                        ))}

                    {detail.kind === "snapshot" && (
                        <div>
                            <p className="mb-1.5 font-semibold text-foreground">{detail.label}</p>
                            <dl className="max-h-48 divide-y divide-border overflow-y-auto rounded-md border border-border">
                                {detail.rows.map((row) => (
                                    <div key={row.key} className="flex gap-3 px-3 py-1.5">
                                        <dt className="w-36 shrink-0 font-medium text-foreground">
                                            {row.key}
                                        </dt>
                                        <dd className="min-w-0 break-words font-mono text-muted-foreground">
                                            {row.value}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}

                    {detail.kind === "none" && (
                        <p className="text-muted-foreground">
                            No payload was recorded for this event.
                        </p>
                    )}

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-muted-foreground">
                        <span>Log #{log.id}</span>
                        {log.correlationId && (
                            <CopyValue label="Request" value={log.correlationId} />
                        )}
                    </div>
                </div>
            )}
        </li>
    );
}

/**
 * Drill-down history of the audit log.
 *   object type (AUTH) -> narrow by action / result / actor / period -> one record (#1) -> one event.
 * Replaces the single-record dialog on the audit page; it only uses the existing audit endpoints.
 */
export function AuditHistoryExplorer({
                                         initialScope,
                                         onClose,
                                     }: AuditHistoryExplorerProps) {
    const [scope, setScope] = useState<AuditHistoryScope>(initialScope);
    const [action, setAction] = useState(initialScope.action ?? "");
    const [result, setResult] = useState<ResultFilter>("");
    const [period, setPeriod] = useState<Period>("all");
    const [actorDraft, setActorDraft] = useState("");
    const [pageState, setPageState] = useState({ key: "", page: 0 });
    const [expanded, setExpanded] = useState<Set<number>>(() => new Set());

    const actorTerm = useDebouncedValue(actorDraft.trim());
    const isRecord = scope.entityId !== null;
    const range = useMemo(() => periodRange(period), [period]);

    // The page goes back to the first one whenever the scope or a filter changes (no effect needed)
    const filterKey = [
        scope.entityType,
        scope.entityId ?? "*",
        action,
        result,
        actorTerm,
        period,
    ].join("|");
    const page = pageState.key === filterKey ? pageState.page : 0;
    const setPage = (next: number) => setPageState({ key: filterKey, page: next });

    const listQuery = useQuery({
        queryKey: [
            "audit-history",
            scope.entityType,
            scope.entityId,
            action,
            result,
            actorTerm,
            period,
            page,
        ],
        queryFn: () =>
            scope.entityId !== null
                ? auditLogApi.getEntityHistory(
                    scope.entityType,
                    scope.entityId,
                    page,
                    PAGE_SIZE,
                )
                : auditLogApi.getPage({
                    entityType: scope.entityType,
                    action: action || undefined,
                    result: result || undefined,
                    actorName: actorTerm || undefined,
                    fromDate: range.fromDate,
                    toDate: range.toDate,
                    page,
                    size: PAGE_SIZE,
                }),
        placeholderData: keepPreviousData,
    });

    // Counts per action for this object type (from the statistics endpoint)
    const statsQuery = useQuery({
        queryKey: ["audit-history-stats", period],
        queryFn: () => auditLogApi.getStats(range),
        enabled: !isRecord,
        staleTime: 60_000,
    });

    const content = listQuery.data?.content;
    const logs = content ?? [];
    const total = listQuery.data?.totalElements ?? 0;
    const totalPages = listQuery.data?.totalPages ?? 0;

    const actionChips = useMemo(() => {
        const fromStats = (statsQuery.data?.byEntityAction ?? [])
            .filter((item) => item.entityType === scope.entityType)
            .sort((a, b) => b.count - a.count)
            .map((item) => ({ key: item.action, count: item.count as number | undefined }));

        if (fromStats.length > 0) return fromStats;

        // No statistics for this type: fall back to the actions seen on the current page
        const seen = new Set<string>();

        (content ?? []).forEach((log) => seen.add(log.action));

        return Array.from(seen).map((key) => ({ key, count: undefined as number | undefined }));
    }, [statsQuery.data, scope.entityType, content]);

    const hasFilters = Boolean(action || result || actorDraft);

    const clearFilters = () => {
        setAction("");
        setResult("");
        setActorDraft("");
    };

    const openRecord = (entityId: string) => {
        clearFilters();
        setScope({ entityType: scope.entityType, entityId });
    };

    const backToType = () => setScope({ entityType: scope.entityType, entityId: null });

    const toggle = (id: number) =>
        setExpanded((previous) => {
            const next = new Set(previous);

            if (next.has(id)) next.delete(id);
            else next.add(id);

            return next;
        });

    const rangeStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
    const rangeEnd = Math.min((page + 1) * PAGE_SIZE, total);

    return (
        <Dialog open onOpenChange={(next) => !next && onClose()}>
            <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-3xl">
                <DialogHeader>
                    <DialogTitle className="flex flex-wrap items-center gap-1.5">
                        <History className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                        {isRecord ? (
                            <>
                                <button
                                    type="button"
                                    onClick={backToType}
                                    title={`Back to every ${scope.entityType} event`}
                                    className="underline decoration-dotted underline-offset-4 hover:text-indigo-600 dark:hover:text-indigo-400"
                                >
                                    {scope.entityType}
                                </button>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                <span>#{scope.entityId}</span>
                            </>
                        ) : (
                            <span>{scope.entityType}</span>
                        )}
                    </DialogTitle>

                    <DialogDescription>
                        {isRecord
                            ? `${total} change(s) recorded for this record, newest first.`
                            : `${total} event(s) on ${scope.entityType}${
                                hasFilters || period !== "all" ? " match the filters" : ""
                            }. Click an actor to filter by them, or a record number to see only that record.`}
                    </DialogDescription>
                </DialogHeader>

                {!isRecord && (
                    <div className="space-y-3">
                        <div className="flex flex-wrap items-center gap-2">
                            <select
                                value={period}
                                onChange={(event) => setPeriod(event.target.value as Period)}
                                aria-label="Period"
                                className="h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-indigo-400"
                            >
                                {PERIODS.map((item) => (
                                    <option key={item.key} value={item.key}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>

                            <div className="inline-flex rounded-lg border border-border p-0.5">
                                {RESULTS.map((item) => (
                                    <button
                                        key={item.key || "all"}
                                        type="button"
                                        aria-pressed={result === item.key}
                                        onClick={() => setResult(item.key)}
                                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                                            result === item.key
                                                ? "bg-indigo-600 text-white"
                                                : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {item.label}
                                    </button>
                                ))}
                            </div>

                            <input
                                type="text"
                                value={actorDraft}
                                onChange={(event) => setActorDraft(event.target.value)}
                                placeholder="Filter by actor…"
                                aria-label="Filter by actor"
                                className="h-8 min-w-[180px] flex-1 rounded-lg border border-border bg-background px-3 text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-indigo-400"
                            />

                            {hasFilters && (
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                                >
                                    Clear filters
                                </button>
                            )}
                        </div>

                        {actionChips.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <Chip active={action === ""} onClick={() => setAction("")}>
                                    All actions
                                </Chip>

                                {actionChips.map((chip) => (
                                    <Chip
                                        key={chip.key}
                                        active={action === chip.key}
                                        onClick={() => setAction(action === chip.key ? "" : chip.key)}
                                    >
                                        {getActionLabel(chip.key)}
                                        {chip.count !== undefined && (
                                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-foreground/70">
                        {chip.count}
                      </span>
                                        )}
                                    </Chip>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {isRecord && (
                    <button
                        type="button"
                        onClick={backToType}
                        className="self-start text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                    >
                        ← All {scope.entityType} events
                    </button>
                )}

                {listQuery.isPending && (
                    <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
                )}

                {listQuery.isError && (
                    <p className="py-6 text-center text-sm text-red-500">
                        Unable to load history.
                    </p>
                )}

                {listQuery.isSuccess && logs.length === 0 && (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                        <p>No events match.</p>
                        {hasFilters && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="mt-2 text-xs font-medium text-indigo-600 hover:underline dark:text-indigo-400"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                )}

                {logs.length > 0 && (
                    <ul
                        className={`space-y-2 transition-opacity ${
                            listQuery.isFetching ? "opacity-60" : ""
                        }`}
                    >
                        {logs.map((log) => (
                            <HistoryEvent
                                key={log.id}
                                log={log}
                                showObject={!isRecord}
                                expanded={expanded.has(log.id)}
                                onToggle={() => toggle(log.id)}
                                onOpenRecord={openRecord}
                                onFilterActor={isRecord ? undefined : setActorDraft}
                            />
                        ))}
                    </ul>
                )}

                {totalPages > 1 && (
                    <div className="flex items-center justify-between gap-3 border-t border-border pt-3 text-sm">
                        <button
                            type="button"
                            disabled={page === 0}
                            onClick={() => setPage(Math.max(0, page - 1))}
                            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
                        >
                            Previous
                        </button>

                        <span className="text-center text-xs text-muted-foreground">
              {rangeStart}–{rangeEnd} of {total} · page {page + 1} / {totalPages}
            </span>

                        <button
                            type="button"
                            disabled={page + 1 >= totalPages}
                            onClick={() => setPage(page + 1)}
                            className="rounded-md border border-border px-3 py-1.5 disabled:opacity-50"
                        >
                            Next
                        </button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

export default AuditHistoryExplorer;
