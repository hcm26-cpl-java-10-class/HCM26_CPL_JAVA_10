import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Eye, MoreVertical } from "lucide-react";
import { useMemo, useState } from "react";
import { externalApi } from "@/api/features/external.api";
import { ApiErrorState } from "@/components/common/ApiErrorState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { usePermissions } from "@/hooks/usePermissions";
import type { ExternalClass } from "@/types";
import type { ClassCalendarVersion } from "@/types/features/external";
import { retryUnlessClientError } from "@/utils/query.utils";

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
    const [statuses, setStatuses] = useState<CalendarStatus[]>(STATUSES.map((item) => item.value));
    const [detail, setDetail] = useState<ClassCalendarVersion | null>(null);
    const query = useQuery({
        queryKey: ["class-calendars", classItem.id],
        queryFn: () => externalApi.getClassCalendars(classItem.id),
        enabled: canRead,
        retry: retryUnlessClientError,
    });
    const rows = useMemo(() => [...(query.data ?? [])]
        .filter((item) => statuses.includes(item.status))
        .sort((a, b) => b.lastModifiedDate.localeCompare(a.lastModifiedDate) || b.id - a.id), [query.data, statuses]);

    if (!canRead) return <ApiErrorState error={undefined} kind="forbidden" resource="calendar history" />;

    return (
        <div className="min-w-0 space-y-5">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="h-10 w-full justify-between font-normal sm:w-64" aria-label="Filter calendar status">
                        {statuses.length === STATUSES.length ? "All (3 options selected)" : statuses.length === 0 ? "No status selected" : statuses.length === 1 ? STATUSES.find((item) => item.value === statuses[0])?.label : `${statuses.length} options selected`}
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

            <div className="overflow-hidden rounded-lg border">
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
                                <TableCell><button type="button" onClick={() => setDetail(item)} className="text-left font-medium text-blue-800 hover:underline focus-visible:outline-2 dark:text-blue-300">{item.name}</button></TableCell>
                                <TableCell className="min-w-56 max-w-80 whitespace-normal">{item.historyChange || "—"}</TableCell>
                                <TableCell>{modifiedDate(item.lastModifiedDate)}</TableCell>
                                <TableCell>{item.lastModifiedBy || "—"}</TableCell>
                                <TableCell className="text-center"><StatusBadge status={item.status} /></TableCell>
                                <TableCell className="text-center">
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for calendar version ${item.version}`}><MoreVertical className="size-4" /></Button></DropdownMenuTrigger>
                                        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setDetail(item)}><Eye className="size-4" /> View details</DropdownMenuItem></DropdownMenuContent>
                                    </DropdownMenu>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={!!detail} onOpenChange={(open) => { if (!open) setDetail(null); }}>
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader><DialogTitle>Calendar version {detail?.version}</DialogTitle><DialogDescription className="break-all">{detail?.name}</DialogDescription></DialogHeader>
                    {detail && <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-4 text-sm">
                        <dt className="text-muted-foreground">History Change</dt><dd className="break-words">{detail.historyChange}</dd>
                        <dt className="text-muted-foreground">Last Modified Date</dt><dd>{modifiedDate(detail.lastModifiedDate)}</dd>
                        <dt className="text-muted-foreground">Last Modified By</dt><dd>{detail.lastModifiedBy}</dd>
                        <dt className="text-muted-foreground">Status</dt><dd><StatusBadge status={detail.status} /></dd>
                    </dl>}
                </DialogContent>
            </Dialog>
        </div>
    );
}
