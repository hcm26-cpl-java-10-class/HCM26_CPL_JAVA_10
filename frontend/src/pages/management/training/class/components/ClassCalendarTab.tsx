import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlignLeft, CalendarDays, ChevronDown, Download, Eye, MoreVertical, Settings } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { utils, writeFile } from "xlsx";
import { toast } from "sonner";
import { externalApi } from "@/api/features/external.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import type { ClassCalendarVersion } from "@/types/features/external";
import { retryUnlessClientError } from "@/utils/query.utils";
import { CalendarOverviewChart } from "./CalendarOverviewChart";

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
    const [adjustName, setAdjustName] = useState("");
    const [adjustHistory, setAdjustHistory] = useState("");
    const [pending, setPending] = useState<Record<number, ClassCalendarVersion>>({});
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
        setAdjustName(item.name);
        setAdjustHistory(item.historyChange);
    };
    const download = (item: ClassCalendarVersion, detailed: boolean) => {
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

    if (!canRead) return <ApiErrorState error={undefined} kind="forbidden" resource="calendar history" />;

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

            <div className="overflow-hidden border-y">
                <Table aria-label="Calendar version history" className="min-w-[1050px] [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:h-14">
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
                            <TableRow key={item.id}>
                                <TableCell>{index + 1}</TableCell>
                                <TableCell><button type="button" onClick={() => open(item, "detail")} className="text-left font-medium text-blue-800 hover:underline focus-visible:outline-2 dark:text-blue-300">{item.name}</button>{pending[item.id] && <span className="ml-2 text-xs text-amber-700">Unsaved</span>}</TableCell>
                                <TableCell className="min-w-56 max-w-80 whitespace-normal">{item.historyChange || "—"}</TableCell>
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
                </Table>
            </div>

            <footer className="mt-auto flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                <Button variant="outline" asChild><Link to="/classes">Back to Class List</Link></Button>
                <Button disabled={!canUpdate || save.isPending || !Object.keys(pending).length} onClick={() => save.mutate()}>{save.isPending ? "Saving…" : "Save changes"}</Button>
            </footer>

            <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
                {detail && mode === "overview" ? <CalendarOverviewChart calendar={detail} onDownload={() => download(detail, true)} /> : (
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>{mode === "adjust" ? "Adjust calendar" : mode === "overview" ? "Calendar overview" : `Calendar version ${detail?.version}`}</DialogTitle><DialogDescription className="break-all">{detail?.name}</DialogDescription></DialogHeader>
                    {detail && mode === "adjust" ? <form className="space-y-4" onSubmit={(event) => {
                        event.preventDefault();
                        if (!adjustName.trim() || !adjustHistory.trim()) return;
                        setPending((current) => ({ ...current, [detail.id]: { ...detail, name: adjustName.trim(), historyChange: adjustHistory.trim() } }));
                        setDetail(null);
                    }}>
                        <label className="block space-y-2 text-sm font-medium">Calendar Name<Input required maxLength={255} value={adjustName} onChange={(event) => setAdjustName(event.target.value)} /></label>
                        <label className="block space-y-2 text-sm font-medium">History Change<Textarea required maxLength={1000} value={adjustHistory} onChange={(event) => setAdjustHistory(event.target.value)} /></label>
                        <p className="text-xs text-muted-foreground">Apply your adjustments, then select Save changes to save them.</p>
                        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setDetail(null)}>Cancel</Button><Button type="submit" disabled={!adjustName.trim() || !adjustHistory.trim()}>Apply</Button></div>
                    </form> : detail && <><dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-4 text-sm">
                        <dt className="text-muted-foreground">History Change</dt><dd className="break-words">{detail.historyChange}</dd>
                        <dt className="text-muted-foreground">Last Modified Date</dt><dd>{modifiedDate(detail.lastModifiedDate)}</dd>
                        <dt className="text-muted-foreground">Last Modified By</dt><dd>{detail.lastModifiedBy}</dd>
                        <dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={detail.status} /></dd>
                    </dl>
                    </>}
                </DialogContent>
                )}
            </Dialog>
        </div>
    );
}
