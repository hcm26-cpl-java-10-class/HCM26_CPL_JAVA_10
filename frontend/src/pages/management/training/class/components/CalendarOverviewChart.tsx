import { useMemo } from "react";
import { CalendarDays, Download, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { ClassCalendarVersion } from "@/types/features/external";

const DAY = 86400000;
const COLORS = ["#6366f1", "#38bdf8", "#22c55e", "#a78bfa", "#f59e0b", "#ec4899", "#14b8a6"];

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
        for (const item of calendar.overviewItems ?? []) {
            const start = dateValue(item.startDate);
            const end = dateValue(item.endDate);
            if (start === null || end === null || end < start) { unavailable++; continue; }
            groups.set(item.id, { label: item.label, start, end, count: 0 });
        }
        for (const session of calendar.overviewItems?.length ? [] : calendar.sessions ?? []) {
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
    }, [calendar.sessions, calendar.overviewItems]);

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
                        <div className="ml-44 flex justify-between border-b px-3 pb-2 text-xs text-muted-foreground sm:ml-52">
                            {Array.from({ length: 5 }, (_, index) => <span key={index}>{dateLabel(chart.start + (chart.end - chart.start) * index / 4, true)}</span>)}
                        </div>
                        <div role="table" aria-label="Calendar overview by topic">
                            {chart.rows.map((row, index) => {
                                const left = 80 + (row.start - chart.start) / chart.span * 840;
                                const width = Math.max(4, (row.end - row.start + DAY) / chart.span * 840);
                                const range = row.start === row.end ? dateLabel(row.start) : `${dateLabel(row.start)} - ${dateLabel(row.end)}`;
                                return <div role="row" key={`${row.label}-${index}`} className="flex min-h-14">
                                    <div role="rowheader" className="flex w-44 shrink-0 items-center justify-end border-b px-3 text-right text-sm sm:w-52"><span className="truncate" title={row.label}>{row.label}</span></div>
                                    <div role="cell" className="relative min-w-0 flex-1 border-b border-l" aria-label={row.count ? `${range}, ${row.count} ${row.count === 1 ? "session" : "sessions"}` : range}>
                                        <svg viewBox="0 0 1000 56" preserveAspectRatio="none" className="block h-14 w-full" role="img" aria-label={`${row.label}: ${range}`}>
                                            <title>{row.label}: {dateLabel(row.start, true)} – {dateLabel(row.end, true)}</title>
                                            {[80, 290, 500, 710, 920].map((x) => <line key={x} x1={x} x2={x} y1={0} y2={56} className="stroke-border" strokeDasharray="3 4" strokeWidth={0.6} />)}
                                            <rect x={left} y={13} width={width} height={30} rx={2} fill={COLORS[index % COLORS.length]} opacity={0.9} />
                                            <text x={left + width / 2} y={32} textAnchor="middle" fontSize={13} fontWeight={500} className="fill-foreground stroke-background" strokeWidth={4} paintOrder="stroke">{range}</text>
                                        </svg>
                                    </div>
                                </div>;
                            })}
                        </div>
                        <svg viewBox="0 0 1000 30" preserveAspectRatio="none" className="ml-44 h-8 w-[calc(100%-11rem)] sm:ml-52 sm:w-[calc(100%-13rem)]" aria-hidden>
                            {[80, 290, 500, 710, 920].map((x, index) => <g key={x}><line x1={x} x2={x} y1={0} y2={7} className="stroke-border" /><text x={x} y={23} textAnchor="middle" fontSize={11} className="fill-muted-foreground">{dateLabel(chart.start + (chart.end - chart.start) * index / 4)}</text></g>)}
                        </svg>
                    </div>
                ) : <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center text-muted-foreground"><CalendarDays className="size-9" /><p>No dated sessions available for this calendar version.</p></div>}
                {chart.unavailable > 0 && <p className="mt-4 text-xs text-muted-foreground">{chart.unavailable} sessions have no valid date and cannot be shown on the chart.</p>}
            </div>
        </DialogContent>
    );
}
