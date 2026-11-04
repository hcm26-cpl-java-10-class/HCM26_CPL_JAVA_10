import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlignLeft, CalendarDays, Check, ChevronDown, Download, Eye, Loader2, MoreVertical, Pencil, Save, Settings } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { utils, writeFile } from "xlsx";
import { toast } from "sonner";
import { externalApi } from "@/api/features/external.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import type { ClassCalendarVersion } from "@/types/features/external";
import { retryUnlessClientError } from "@/utils/query.utils";
import { CalendarOverviewChart } from "./CalendarOverviewChart";
import { CalendarDetailView } from "./CalendarDetailView";
import { CalendarAdjustView } from "./CalendarAdjustView";
import { downloadBlob } from "@/components/datatable/util/dataio.utils";

const STATUSES = [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "draft", label: "Draft" },
] as const;
type CalendarStatus = ClassCalendarVersion["status"];

function modifiedDate(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";
    const day = date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).replace(/ /g, "-");
    return `${day} ${date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })}`;
}

function StatusBadge({ status }: { status: CalendarStatus }) {
    return <Badge variant="secondary" className={`rounded-full px-3 py-1 font-medium ${status === "active"
        ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200"
        : status === "inactive" ? "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200"
        : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"}`}>
        {STATUSES.find((item) => item.value === status)?.label ?? status}
    </Badge>;
}

export function ClassCalendarTab({ classItem }: { classItem: ExternalClass }) {
    const { hasPermission } = usePermissions();
    const canRead = hasPermission("SESSION_READ");
    const canUpdate = hasPermission("SESSION_UPDATE");
    const queryClient = useQueryClient();
    const [statuses, setStatuses] = useState<CalendarStatus[]>(STATUSES.map((item) => item.value));
    const [detail, setDetail] = useState<ClassCalendarVersion | null>(null);
    const [mode, setMode] = useState<"detail" | "overview" | "adjust">("detail");
    const [pending, setPending] = useState<Record<number, ClassCalendarVersion>>({});
    const [editingNameId, setEditingNameId] = useState<number | null>(null);

    const updatePendingField = (item: ClassCalendarVersion, field: "name" | "historyChange", value: string) => {
        const original = query.data?.find((d) => d.id === item.id);
        const currentPending = pending[item.id] ?? original ?? item;
        const updated = { ...currentPending, [field]: value };
        if (original && updated.name === original.name && (updated.historyChange || "") === (original.historyChange || "")) {
            setPending((prev) => {
                const next = { ...prev };
                delete next[item.id];
                return next;
            });
        } else {
            setPending((prev) => ({ ...prev, [item.id]: updated }));
        }
    };
    const tableViewport = useRef<HTMLDivElement>(null);
    const horizontalScrollbar = useRef<HTMLDivElement>(null);
    const [tableWidth, setTableWidth] = useState(1050);
    const save = useMutation({
        mutationFn: () => externalApi.saveClassCalendars(classItem.id, Object.values(pending).map(({ id, name, historyChange }) => ({ id, name, historyChange }))),
        onSuccess: async () => {
            setPending({});
            await queryClient.invalidateQueries({ queryKey: ["class-calendars", classItem.id] });
            toast.success("Calendar changes saved.");
        },
        onError: () => toast.error("Could not save calendar changes. Please try again."),
    });
    const open = (item: ClassCalendarVersion, view: typeof mode) => {
        setDetail(item);
        setMode(view);
    };
    const download = async (item: ClassCalendarVersion, detailed: boolean) => {
        if (detailed) {
            try {
                const blob = await externalApi.downloadCalendarWithDetailedTime(classItem.id, item.id);
                downloadBlob(blob, `${item.name.replace(/[<>:"/\\|?*]/g, "_")}_detailed_time.xlsx`);
            } catch {
                toast.error("Could not download the detailed training calendar. Please try again.");
            }
            return;
        }
        const workbook = utils.book_new();
        utils.book_append_sheet(workbook, utils.json_to_sheet([{
            "Calendar Name": item.name, "Version": item.version, "History Change": item.historyChange,
            "Last Modified Date": item.lastModifiedDate, "Last Modified By": item.lastModifiedBy, "Status": item.status,
        }]), "Calendar");
        const sessions = (item.sessions ?? []).map((session) => ({
            "Date": session.date, "Topic": session.topic ?? "", "Trainer": session.trainer ?? "", "Room": session.room ?? "",
            ...(detailed ? { "Time Slot": session.slot ?? "", "Type": session.type ?? "", "Status": session.status ?? "" } : {}),
        }));
        utils.book_append_sheet(workbook, utils.json_to_sheet(sessions, { header: detailed ? ["Date", "Topic", "Trainer", "Room", "Time Slot", "Type", "Status"] : ["Date", "Topic", "Trainer", "Room"] }), "Sessions");
        writeFile(workbook, `${item.name.replace(/[<>:"/\\|?*]/g, "_")}${detailed ? "_detailed_time" : ""}.xlsx`);
    };
    const query = useQuery({
        queryKey: ["class-calendars", classItem.id],
        queryFn: () => externalApi.getClassCalendars(classItem.id),
        enabled: canRead,
        retry: retryUnlessClientError,
    });
    const rows = useMemo(() => (query.data ?? []).map((item) => pending[item.id] ?? item)
        .filter((item) => statuses.includes(item.status))
        .sort((a, b) => b.lastModifiedDate.localeCompare(a.lastModifiedDate) || b.id - a.id), [query.data, statuses, pending]);
    const pendingCount = Object.keys(pending).length;
    const canSave = canUpdate && pendingCount > 0 && !save.isPending;

    useEffect(() => {
        const viewport = tableViewport.current;
        if (!viewport) return;
        const measure = () => {
            const contentWidth = Math.max(viewport.scrollWidth, viewport.querySelector("table")?.scrollWidth ?? 0);
            setTableWidth(contentWidth + viewport.offsetWidth - viewport.clientWidth);
        };
        const observer = new ResizeObserver(measure);
        observer.observe(viewport);
        const table = viewport.querySelector("table");
        if (table) observer.observe(table);
        measure();
        return () => observer.disconnect();
    }, [canRead, query.data, pending, mode, detail?.id]);

    if (!canRead) return <ApiErrorState error={undefined} kind="forbidden" resource="calendar history" />;
    if (detail && mode === "detail") return <CalendarDetailView calendar={detail} classItem={classItem} onBack={() => setDetail(null)} />;
    if (detail && mode === "adjust" && canUpdate) return <CalendarAdjustView calendar={detail} classItem={classItem} onBack={() => setDetail(null)} />;

    return (
        <div className="flex min-h-[480px] min-w-0 flex-col gap-5">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-between font-normal sm:w-64" aria-label="Filter calendar status">
                        {statuses.length === STATUSES.length ? "All (3 option selected)" : statuses.length === 0 ? "No status selected" : statuses.length === 1 ? STATUSES.find((item) => item.value === statuses[0])?.label : `${statuses.length} options selected`}
                        <ChevronDown className="size-4 text-muted-foreground" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-64">
                    <DropdownMenuCheckboxItem checked={statuses.length === 3 ? true : statuses.length ? "indeterminate" : false}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setStatuses(checked ? STATUSES.map((item) => item.value) : [])}>All</DropdownMenuCheckboxItem>
                    {STATUSES.map((item) => <DropdownMenuCheckboxItem key={item.value} checked={statuses.includes(item.value)}
                        onSelect={(event) => event.preventDefault()}
                        onCheckedChange={(checked) => setStatuses((current) => checked ? [...current, item.value] : current.filter((value) => value !== item.value))}>
                        {item.label}
                    </DropdownMenuCheckboxItem>)}
                </DropdownMenuContent>
            </DropdownMenu>

            <div ref={tableViewport} role="region" aria-label="Scrollable calendar table" tabIndex={0}
                onScroll={(event) => {
                    if (horizontalScrollbar.current) horizontalScrollbar.current.scrollLeft = event.currentTarget.scrollLeft;
                }}
                className="max-h-[55dvh] w-full min-w-0 overflow-x-hidden overflow-y-auto border-y focus-visible:outline-2 focus-visible:outline-blue-800">
                <table aria-label="Calendar version history" className="w-full min-w-[1450px] caption-bottom text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:h-14">
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-14">No.</TableHead>
                            <TableHead>Calendar Name</TableHead>
                            <TableHead>History Change</TableHead>
                            <TableHead>Last Modified Date</TableHead>
                            <TableHead>Last Modified By</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="w-20 text-center">Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {query.isPending ? Array.from({ length: 5 }, (_, index) => <TableRow key={index}>
                            <TableCell colSpan={7}><Skeleton className="h-7 w-full" /></TableCell>
                        </TableRow>) : query.isError ? (
                            <TableRow><TableCell colSpan={7} className="whitespace-normal"><ApiErrorState error={query.error} resource="calendar history" onRetry={() => void query.refetch()} /></TableCell></TableRow>
                        ) : rows.length === 0 ? (
                            <TableRow><TableCell colSpan={7} className="h-40 text-center">
                                <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground" />
                                <p className="text-sm text-muted-foreground">{query.data?.length ? "No calendars match the selected statuses." : "No calendar versions available for this class yet."}</p>
                            </TableCell></TableRow>
                        ) : rows.map((item, index) => (
                            <TableRow key={item.id} className={pending[item.id] ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell className="min-w-64">
                                    {editingNameId === item.id ? (
                                        <div className="flex items-center gap-1">
                                            <input
                                                type="text"
                                                autoFocus
                                                aria-label={`Calendar name for version ${item.version}`}
                                                value={item.name}
                                                className="h-8 w-full rounded border border-blue-400 bg-background px-2 py-1 text-sm font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-blue-400"
                                                onChange={(e) => updatePendingField(item, "name", e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === "Escape") setEditingNameId(null);
                                                }}
                                                onBlur={() => setEditingNameId(null)}
                                            />
                                            <Button size="icon" variant="ghost" className="size-8 shrink-0 text-green-600 hover:text-green-700" onClick={() => setEditingNameId(null)} aria-label="Confirm name">
                                                <Check className="size-4" />
                                            </Button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-1.5">
                                            <button type="button" onClick={() => open(item, "detail")} className="text-left font-medium text-blue-800 hover:underline focus-visible:outline-2 dark:text-blue-300">
                                                {item.name}
                                            </button>
                                            {canUpdate && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    type="button"
                                                    onClick={() => setEditingNameId(item.id)}
                                                    className="size-6 text-muted-foreground opacity-60 transition-opacity hover:opacity-100 hover:text-foreground"
                                                    title="Click to rename"
                                                    aria-label={`Rename ${item.name}`}
                                                >
                                                    <Pencil className="size-3" />
                                                </Button>
                                            )}
                                            {pending[item.id] && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300">Unsaved</span>}
                                        </div>
                                    )}
                                </TableCell>
                                <TableCell className="min-w-56 max-w-80">
                                    {canUpdate ? (
                                        <input
                                            type="text"
                                            aria-label={`History change note for version ${item.version}`}
                                            value={item.historyChange ?? ""}
                                            placeholder="Add change note…"
                                            className="w-full rounded border border-transparent bg-transparent px-2 py-1 text-sm text-foreground transition-colors hover:border-input focus:border-blue-400 focus:bg-background focus:outline-none focus:ring-1 focus:ring-blue-400 placeholder:text-muted-foreground/60"
                                            onChange={(e) => updatePendingField(item, "historyChange", e.target.value)}
                                        />
                                    ) : (
                                        <span className="whitespace-normal">{item.historyChange || "—"}</span>
                                    )}
                                </TableCell>
                                <TableCell>{modifiedDate(item.lastModifiedDate)}</TableCell>
                                <TableCell>{item.lastModifiedBy || "—"}</TableCell>
                                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for calendar version ${item.version}`}><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end" className="w-72 p-2 shadow-lg">
                                            <DropdownMenuItem className="gap-3 px-3 py-3" onSelect={() => open(item, "detail")}><Eye /> Detail</DropdownMenuItem>
                                            <DropdownMenuItem className="gap-3 px-3 py-3" onSelect={() => download(item, false)}><Download /> Download</DropdownMenuItem>
                                            <DropdownMenuItem className="gap-3 px-3 py-3" onSelect={() => download(item, true)}><Download /> Download with detailed time</DropdownMenuItem>
                                            <DropdownMenuItem className="gap-3 px-3 py-3" onSelect={() => open(item, "overview")}><AlignLeft /> Overview</DropdownMenuItem>
                                            <DropdownMenuItem disabled={!canUpdate || save.isPending} className="gap-3 px-3 py-3 text-amber-600 focus:text-amber-700 [&>svg]:text-amber-500" onSelect={() => open(item, "adjust")}><Settings /> Adjust</DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </table>
            </div>

            <footer className="sticky bottom-0 z-10 mt-auto flex flex-wrap items-center justify-between gap-3 border-t bg-card pb-4">
            <div ref={horizontalScrollbar} role="region" aria-label="Scroll calendar columns horizontally" tabIndex={0}
                onScroll={(event) => {
                    if (tableViewport.current) tableViewport.current.scrollLeft = event.currentTarget.scrollLeft;
                }}
                className="h-6 w-full min-w-0 shrink-0 basis-full overflow-x-scroll overflow-y-hidden border-b bg-neutral-100 [scrollbar-width:auto] [scrollbar-color:#909090_#f5f5f5] [&::-webkit-scrollbar]:h-4 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-400 [&::-webkit-scrollbar-track]:bg-neutral-100">
                <div style={{ width: tableWidth, minWidth: 1450 }} className="h-px" />
            </div>
                <Button variant="outline" asChild><Link to="/classes">Back to Class List</Link></Button>
                <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
                    <p id="calendar-save-status" role="status" className="text-xs text-muted-foreground">
                        {!canUpdate ? "Read-only access" : pendingCount > 0 ? `${pendingCount} unsaved ${pendingCount === 1 ? "change" : "changes"}` : "No unsaved changes"}
                    </p>
                    <Button type="button" className="min-w-36 bg-blue-800 text-white hover:bg-blue-900 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-400 disabled:opacity-100 dark:disabled:bg-neutral-800 dark:disabled:text-neutral-500" disabled={!canSave}
                        aria-describedby="calendar-save-status" aria-busy={save.isPending}
                        onClick={() => { if (canSave) save.mutate(); }}>
                        {save.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Save className="size-4" aria-hidden />}
                        {save.isPending ? "Saving…" : "Save changes"}
                    </Button>
                </div>
            </footer>

            <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
                {detail && mode === "overview" && <CalendarOverviewChart calendar={detail} onDownload={() => download(detail, true)} />}
            </Dialog>
        </div>
    );
}
