import { useMemo } from "react";
import { CalendarDays, Download, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ClassCalendarVersion } from "@/types/features/external";

const DAY = 86400000;

function dateValue(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const timestamp = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value ? timestamp : null;
}

function dateLabel(value: number, year = false) {
    return new Date(value).toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", ...(year ? { year: "numeric" } : {}), timeZone: "UTC",
    }).replace(/ /g, "-");
}

export function CalendarOverviewChart({ calendar, onDownload }: {
    calendar: ClassCalendarVersion;
    onDownload: () => void;
}) {
    const chart = useMemo(() => {
        const groups = new Map<string, { label: string; start: number; end: number; count: number }>();
        let unavailable = 0;
        for (const session of calendar.sessions ?? []) {
            const date = dateValue(session.date);
            if (date === null) { unavailable++; continue; }
            const label = session.topic?.trim() || `Session #${session.id}`;
            const group = groups.get(label);
            if (group) {
                group.start = Math.min(group.start, date);
                group.end = Math.max(group.end, date);
                group.count++;
            } else groups.set(label, { label, start: date, end: date, count: 1 });
        }
        const rows = [...groups.values()].sort((a, b) => a.start - b.start || a.label.localeCompare(b.label));
        const start = rows.length ? Math.min(...rows.map((row) => row.start)) : 0;
        const end = rows.length ? Math.max(...rows.map((row) => row.end)) : 0;
        return { rows, start, end, span: Math.max(DAY, end - start + DAY), unavailable };
    }, [calendar.sessions]);

    return (
        <DialogContent showCloseButton={false} className="flex h-[88dvh] max-h-[950px] w-[calc(100%-2rem)] max-w-[1500px] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(1500px,calc(100vw-4rem))]">
            <header className="flex shrink-0 items-center justify-between gap-4 bg-indigo-600 px-5 py-4 text-white sm:px-7">
                <DialogTitle className="text-base font-semibold sm:text-lg">Calendar Overview Chart</DialogTitle>
                <DialogDescription className="sr-only">Schedule overview for {calendar.name}, version {calendar.version}. Rows show each topic's first and last scheduled dates.</DialogDescription>
                <DialogClose asChild><Button variant="ghost" size="icon" className="shrink-0 rounded-full text-white hover:bg-white/15 hover:text-white" aria-label="Close calendar overview"><X className="size-5" /></Button></DialogClose>
            </header>
            <div className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">
                <div className="mb-3 flex items-center justify-between gap-3">
                    <p className="min-w-0 truncate text-xs text-muted-foreground" title={calendar.name}>{calendar.name}</p>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Chart options"><Menu className="size-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end"><DropdownMenuItem onSelect={onDownload}><Download className="size-4" /> Download with detailed time</DropdownMenuItem></DropdownMenuContent>
                    </DropdownMenu>
                </div>
                {chart.rows.length ? (
                    <div className="min-w-[700px]">
                        <div className="ml-44 flex justify-between border-b pb-2 pl-4 text-xs text-muted-foreground sm:ml-52">
                            <span>{dateLabel(chart.start, true)}</span><span>{dateLabel(chart.end, true)}</span>
                        </div>
                        <div role="table" aria-label="Calendar overview by topic">
                            {chart.rows.map((row) => {
                                const left = (row.start - chart.start) / chart.span * 100;
                                const width = Math.max(0.5, (row.end - row.start + DAY) / chart.span * 100);
                                const range = row.start === row.end ? dateLabel(row.start) : `${dateLabel(row.start)} - ${dateLabel(row.end)}`;
                                return <div role="row" key={row.label} className="flex min-h-14">
                                    <div role="rowheader" className="flex w-44 shrink-0 items-center justify-end border-b px-3 text-right text-sm sm:w-52"><span className="truncate" title={row.label}>{row.label}</span></div>
                                    <div role="cell" className="relative min-w-0 flex-1 border-b border-l" aria-label={`${range}, ${row.count} ${row.count === 1 ? "session" : "sessions"}`}>
                                        <div className="absolute inset-y-0 left-0 right-0 bg-[linear-gradient(to_right,transparent_calc(25%-1px),var(--color-border)_25%,transparent_calc(25%+1px))] bg-[length:25%_100%] opacity-30" aria-hidden />
                                        <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-indigo-200 dark:bg-indigo-900" style={{ left: `${left}%`, width: `${width}%` }} aria-hidden />
                                        <span className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-background/90 px-1 text-xs font-medium sm:text-sm" style={{ left: `${Math.min(left, 76)}%` }} title={`${row.label}: ${range}`}>{range}</span>
                                    </div>
                                </div>;
                            })}
                        </div>
                    </div>
                ) : <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground"><CalendarDays className="size-9" /><p>No dated sessions available for this calendar version.</p></div>}
                {chart.unavailable > 0 && <p className="mt-4 text-xs text-muted-foreground">{chart.unavailable} sessions have no valid date and cannot be shown on the chart.</p>}
            </div>
        </DialogContent>
    );
}
