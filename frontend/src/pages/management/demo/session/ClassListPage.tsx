import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, GraduationCap, HelpCircle, Search, SlidersHorizontal } from "lucide-react";
import axios from "@/api/axios";
import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface TrainingClass {
    id: number;
    code?: string;
    name?: string;
    programId?: number;
    startDate?: string;
    status?: string;
    plannedSize?: number;
}

const statusLabel = (status?: string) => {
    const value = (status ?? "").trim().replace(/[_-]+/g, " ").toLowerCase();
    if (["completed", "training completed"].includes(value)) return "Training completed";
    if (["active", "in progress", "training"].includes(value)) return "In progress";
    return value ? value.charAt(0).toUpperCase() + value.slice(1) : "—";
};

function formatDate(value?: string) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-GB", {
        day: "2-digit", month: "short", year: "numeric",
    }).replace(/ /g, "-");
}

export default function ClassListPage() {
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [descending, setDescending] = useState(false);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const classes = useQuery({
        queryKey: ["training-classes"],
        queryFn: async () => (await axios.get<TrainingClass[]>("/external/classes", {
            params: { status: "" },
        })).data,
    });
    const statuses = useMemo(() => [...new Set((classes.data ?? []).map((item) => statusLabel(item.status)))].sort(), [classes.data]);
    const rows = useMemo(() => {
        const keyword = search.trim().toLowerCase();
        return (classes.data ?? []).filter((item) =>
            (!status || statusLabel(item.status) === status) &&
            (!keyword || [item.code, item.name, item.programId, statusLabel(item.status)]
                .some((value) => String(value ?? "").toLowerCase().includes(keyword))),
        ).sort((a, b) => (descending ? -1 : 1) * (a.code || a.name || "").localeCompare(b.code || b.name || "", undefined, { numeric: true }));
    }, [classes.data, search, status, descending]);
    const selectedCount = rows.filter((row) => selected.has(row.id)).length;
    const toggleRow = (id: number, checked: boolean) => setSelected((previous) => {
        const next = new Set(previous);
        if (checked) next.add(id); else next.delete(id);
        return next;
    });

    return (
        <MainLayout pathName={{ sessions: "Class List" }}>
            <section className="w-full min-w-0 overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
                <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                    <div className="flex items-center gap-2">
                        <h1 className="text-lg font-semibold">Class List</h1>
                        <span title="Classes synchronized from the training system"><HelpCircle className="size-4 text-muted-foreground" /></span>
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                        <div className="relative min-w-0 flex-1 sm:w-64">
                            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                            <Input aria-label="Search classes" placeholder="Search classes..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
                        </div>
                        <Button variant="outline" aria-expanded={filtersOpen} aria-controls="class-list-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
                            <SlidersHorizontal className="size-4" /> Filter
                            {status && <Badge className="bg-blue-800 text-white">1</Badge>}
                        </Button>
                    </div>
                </div>
                {filtersOpen && (
                    <div id="class-list-filters" className="flex flex-wrap items-center gap-3 border-b bg-muted/30 px-5 py-3">
                        <label htmlFor="class-status" className="text-sm font-medium">Status</label>
                        <select id="class-status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-9 rounded-md border bg-background px-3 text-sm">
                            <option value="">All statuses</option>
                            {statuses.map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                        {status && <Button variant="ghost" size="sm" onClick={() => setStatus("")}>Clear filter</Button>}
                    </div>
                )}
                {classes.isPending ? (
                    <p role="status" className="p-12 text-center text-sm text-muted-foreground">Loading classes...</p>
                ) : classes.isError ? (
                    <div role="alert" className="space-y-3 p-10 text-center">
                        <p className="text-sm text-muted-foreground">Could not load classes from the training system. Please check that the external service is available.</p>
                        <Button variant="outline" onClick={() => void classes.refetch()}>Try again</Button>
                    </div>
                ) : (
                    <>
                        <Table className="min-w-[1120px] [&_td]:px-4 [&_td]:py-4 [&_th]:px-4">
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-12"><Checkbox aria-label="Select all visible classes" checked={rows.length > 0 && selectedCount === rows.length ? true : selectedCount > 0 ? "indeterminate" : false} disabled={!rows.length} onCheckedChange={(checked) => setSelected((previous) => {
                                        const next = new Set(previous);
                                        rows.forEach((row) => { if (checked === true) next.add(row.id); else next.delete(row.id); });
                                        return next;
                                    })} /></TableHead>
                                    <TableHead>#</TableHead>
                                    <TableHead aria-sort={descending ? "descending" : "ascending"}>
                                        <button className="flex items-center gap-2 rounded-sm py-2 focus-visible:outline-2" onClick={() => setDescending(!descending)}>Class {descending ? <ArrowDown className="size-4" /> : <ArrowUp className="size-4" />}</button>
                                    </TableHead>
                                    {["Site", "Trainee Type", "Program", "Class Admin", "Trainees", "Start Date", "Master Trainer", "Status"].map((label) => <TableHead key={label}>{label}</TableHead>)}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rows.map((row, index) => {
                                    const label = statusLabel(row.status);
                                    return <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined}>
                                        <TableCell><Checkbox aria-label={`Select ${row.code || row.name || row.id}`} checked={selected.has(row.id)} onCheckedChange={(checked) => toggleRow(row.id, checked === true)} /></TableCell>
                                        <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                                        <TableCell className="font-medium text-blue-800 dark:text-blue-300">{row.code || row.name || `Class ${row.id}`}</TableCell>
                                        <TableCell>—</TableCell><TableCell>—</TableCell>
                                        <TableCell>{row.programId != null ? `Program #${row.programId}` : "—"}</TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell>{row.plannedSize != null ? `— / ${row.plannedSize}` : "—"}</TableCell>
                                        <TableCell>{formatDate(row.startDate)}</TableCell>
                                        <TableCell>—</TableCell>
                                        <TableCell><Badge variant="secondary" className={label === "Training completed" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200" : label === "In progress" ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200" : ""}>{label}</Badge></TableCell>
                                    </TableRow>;
                                })}
                            </TableBody>
                        </Table>
                        {!rows.length && <div className="space-y-2 p-12 text-center text-muted-foreground"><GraduationCap className="mx-auto size-8" /><p className="text-sm">{search || status ? "No classes match your search or filters." : "No classes available."}</p></div>}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-t px-5 py-4 text-xs text-muted-foreground">
                            <span>{rows.length} classes{selectedCount > 0 ? ` · ${selectedCount} selected` : ""}</span>
                            {rows.length > 0 && <span>You've reached the end</span>}
                        </div>
                    </>
                )}
            </section>
        </MainLayout>
    );
}
