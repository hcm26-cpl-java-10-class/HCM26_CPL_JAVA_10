
import { useState } from "react";
import { Link } from "react-router-dom";
import {
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
    Eye,
    LockKeyhole,
    Pencil,
    Plus,

    Trash2,

} from "lucide-react";

import {
    syllabusApi,
    type SyllabusInput,
    type SyllabusSummary,
} from "@/api/features/demo/syllabus.api";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FormModal } from "@/components/datatable/modal/form/FormModal";
import type { EntitySchema } from "@/types";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useDebouncedValue } from "@/pages/management/demo/course/hooks/useDebouncedValue";
import { usePermissions } from "@/hooks/usePermissions";
import { SyllabusImportAction } from "./SyllabusImportAction";
import { SyllabusListToolbar, SyllabusListFooter, type SyllabusViewMode } from "./SyllabusListControls";
import { SyllabusStatFilterCard } from "./SyllabusStatFilterCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const PAGE_SIZE = 10;

const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ");

const syllabusSchema: EntitySchema = {
    entityName: "syllabus",
    idField: "id",
    fields: [
        {
            name: "code",
            label: "Syllabus Code",
            type: "text",
            hint: "Unique syllabus code, e.g. DEMO-JAV201",
            validation: {
                required: true,
                requiredMessage: "Syllabus code is required",
                minLength: 3,
                maxLength: 30,
                pattern: {
                    regex: /^[A-Za-z0-9][A-Za-z0-9_-]{2,29}$/,
                    message:
                        "Use 3-30 characters: letters, numbers, _ or -. Start with a letter or number.",
                },
            },
        },
        {
            name: "name",
            label: "Syllabus Name",
            type: "text",
            hint: "Unique name, e.g. Java Fundamentals",
            validation: {
                required: true,
                requiredMessage: "Syllabus name is required",
                minLength: 3,
                maxLength: 150,
                custom: (value) => {
                    const name = normalize(String(value ?? ""));

                    if (!name) return null;

                    return /\p{L}/u.test(name)
                        ? null
                        : "Syllabus name must contain at least one letter";
                },
            },
        },
        {
            name: "description",
            label: "Description",
            type: "textarea",
            hint: "Brief overview of the syllabus",
            validation: {
                maxLength: 1500,
            },
        },
    ],
};

function errorMessage(error: unknown) {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | {
            errors?: Record<string, string[]>;
            message?: string;
            detail?: string;
        }
            | undefined;

        const first = data?.errors
            ? Object.values(data.errors).flat()[0]
            : undefined;

        if (first) return first;
        if (data?.detail) return data.detail;
        if (data?.message) return data.message;

        if (error.response?.status === 403) {
            return "Action denied or missing permission.";
        }
    }

    return error instanceof Error
        ? error.message
        : "Operation failed. Check the Backend connection.";
}

export default function SyllabusesPage() {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();

    const canCreate = hasPermission("SYLLABUS_CREATE");
    const canEdit = hasPermission("SYLLABUS_UPDATE");
    const canDelete = hasPermission("SYLLABUS_DELETE");

    const [search, setSearch] = useState("");
    const debouncedSearch = useDebouncedValue(
        search.trim(),
        400
    );

    const [status, setStatus] = useState("all");
    const [sortBy, setSortBy] = useState("name");
    const [page, setPage] = useState(0);
    const [pageSize, setPageSize] = useState(PAGE_SIZE);
    const [view, setView] = useState<SyllabusViewMode>("table");

    const [serverErrors, setServerErrors] =
        useState<Record<string, string[]>>({});

    const [editing, setEditing] =
        useState<SyllabusSummary | null>(null);

    const [formOpen, setFormOpen] = useState(false);

    const [deleting, setDeleting] =
        useState<SyllabusSummary | null>(null);

    const [busy, setBusy] = useState(false);

    const query = useQuery({
        queryKey: ["syllabuses", debouncedSearch],
        queryFn: () =>
            syllabusApi.list(debouncedSearch),
    });

    const all = query.data ?? [];

    const filtered = all.filter(
        (s) =>
            status === "all" ||
            s.status === status
    );

    const rows = [...filtered].sort(
        (a, b) =>
            sortBy === "completion"
                ? b.completionPercent - a.completionPercent || a.name.localeCompare(b.name)
                : sortBy === "code"
                    ? a.code.localeCompare(b.code)
                    : a.name.localeCompare(b.name)
    );

    const totalPages = Math.ceil(
        rows.length / pageSize
    );

    const effectivePage = Math.min(
        page,
        Math.max(0, totalPages - 1)
    );

    const paged = rows.slice(
        effectivePage * pageSize,
        (effectivePage + 1) * pageSize
    );

    const draftCount = all.filter(
        (s) => s.status === "DRAFT"
    ).length;

    const publishedCount = all.filter(
        (s) => s.status === "PUBLISHED"
    ).length;

    function openCreate() {
        setEditing(null);
        setServerErrors({});
        setFormOpen(true);
    }

    function openEdit(item: SyllabusSummary) {
        if (item.status === "PUBLISHED") {
            toast.error(
                "Return this Syllabus to Draft before editing."
            );
            return;
        }

        setEditing(item);
        setServerErrors({});
        setFormOpen(true);
    }

    async function refreshList() {
        await qc.invalidateQueries({
            queryKey: ["syllabuses"],
        });
    }

    async function save(values: Record<string, unknown>) {
        if (busy) return;

        if (editing?.status === "PUBLISHED") {
            toast.error("Published Syllabus is read-only.");
            return;
        }

        const clean: SyllabusInput = {
            code: String(values.code ?? "").trim().toUpperCase(),
            name: normalize(String(values.name ?? "")),
            description: normalize(
                String(values.description ?? "")
            ),
        };

        setServerErrors({});
        setBusy(true);

        try {
            if (editing) {
                await syllabusApi.update(editing.id, clean);
            } else {
                await syllabusApi.create(clean);
            }

            await refreshList();
            setFormOpen(false);

            toast.success(
                editing
                    ? "Syllabus updated successfully."
                    : "Syllabus created successfully."
            );
        } catch (error) {
            const errors = axios.isAxiosError(error)
                ? (
                    error.response?.data as {
                        errors?: Record<string, string[]>;
                    } | undefined
                )?.errors
                : undefined;

            if (
                errors &&
                Object.values(errors).some(
                    (messages) =>
                        Array.isArray(messages) &&
                        messages.length > 0
                )
            ) {
                setServerErrors(errors);

                toast.error(
                    "Please correct the highlighted fields."
                );
            } else {
                toast.error(errorMessage(error));
            }
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!deleting || busy) return;

        if (deleting.status === "PUBLISHED") {
            toast.error(
                "Published Syllabus cannot be deleted."
            );
            return;
        }

        setBusy(true);

        try {
            await syllabusApi.delete(deleting.id);
            await refreshList();

            setDeleting(null);
            toast.success(
                "Syllabus deleted successfully."
            );
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }


    return (
        <MainLayout
            pathName={{ syllabuses: "Syllabuses" }}
        >
            <div className="flex w-full flex-col gap-4 pb-5 font-inter">
                {/* Keep Syllabus semantics while following the Course list layout. */}
                <header className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                        <h1 className="text-xl font-semibold tracking-tight">Syllabuses</h1>
                        <p className="text-sm text-muted-foreground">Create, manage and publish course outlines.</p>
                    </div>
                </header>

                <section className="grid gap-3 sm:grid-cols-3" aria-label="Syllabus overview">
                    {([
                        { label: debouncedSearch ? "Matching syllabuses" : "Total syllabuses", count: all.length, filter: "all", hint: "Show all Syllabuses" },
                        { label: "Draft", count: draftCount, filter: "DRAFT", hint: "Show Draft Syllabuses only" },
                        { label: "Published", count: publishedCount, filter: "PUBLISHED", hint: "Show Published Syllabuses only" },
                    ] as const).map((item) => (
                        <SyllabusStatFilterCard
                            key={item.filter}
                            label={item.label}
                            value={query.isPending ? "—" : item.count}
                            hint={item.hint}
                            selected={status === item.filter}
                            onClick={() => {
                                setStatus(item.filter);
                                setSearch("");
                                setPage(0);
                            }}
                        />
                    ))}
                </section>

                <SyllabusListToolbar
                    search={search}
                    searchLabel="Search syllabus name or code"
                    view={view}
                    onViewChange={setView}
                    onSearchChange={(value) => { setSearch(value); setPage(0); }}
                    filters={<>
                        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(0); }}>
                            <SelectTrigger aria-label="Filter syllabus status" className="h-9 w-[142px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All statuses</SelectItem>
                                <SelectItem value="DRAFT">Draft</SelectItem>
                                <SelectItem value="PUBLISHED">Published</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={sortBy} onValueChange={(value) => { setSortBy(value); setPage(0); }}>
                            <SelectTrigger aria-label="Sort syllabuses" className="h-9 w-[158px]">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="name">Name (A–Z)</SelectItem>
                                <SelectItem value="code">Code (A–Z)</SelectItem>
                                <SelectItem value="completion">Completion (high)</SelectItem>
                            </SelectContent>
                        </Select>
                    </>}
                    actions={<>
                        {import.meta.env.DEV && canCreate && canEdit && <SyllabusImportAction />}
                        {canCreate && (
                            <Button size="sm" onClick={openCreate}>
                                <Plus className="size-4" /> Create Syllabus
                            </Button>
                        )}
                    </>}
                />

                {(search || status !== "all") && (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>{query.isPending ? "Loading…" : `${rows.length} matching syllabuses`}</span>
                        <Button type="button" variant="ghost" size="sm" onClick={() => {
                            setSearch(""); setStatus("all"); setPage(0);
                        }}>Clear filters</Button>
                    </div>
                )}

                {query.isPending ? (
                    <div className="rounded-md border bg-card p-8 text-center text-sm text-muted-foreground">Loading syllabuses…</div>
                ) : query.isError ? (
                    <div role="alert" className="rounded-md border bg-card p-8 text-center">
                        <p className="text-sm text-destructive">Unable to load syllabuses.</p>
                        <Button className="mt-3" variant="outline" onClick={() => void query.refetch()}>Retry</Button>
                    </div>
                ) : view === "table" ? (
                    <div className="overflow-x-auto rounded-md border bg-card">
                        <Table className="min-w-[920px] table-fixed text-sm">
                            <TableHeader className="bg-background">
                                <TableRow>
                                    <TableHead className="w-12 text-center">#</TableHead>
                                    <TableHead className="w-[160px]">Code</TableHead>
                                    <TableHead>Name</TableHead>
                                    <TableHead className="w-24 text-center">Sections</TableHead>
                                    <TableHead className="w-32">Status</TableHead>
                                    <TableHead className="w-[170px]">Completion</TableHead>
                                    <TableHead className="w-32 text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paged.map((item, index) => {
                                    const published = item.status === "PUBLISHED";
                                    return (
                                        <TableRow key={item.id} className="odd:bg-muted/20">
                                            <TableCell className="text-center text-muted-foreground tabular-nums">
                                                {effectivePage * pageSize + index + 1}
                                            </TableCell>
                                            <TableCell className="truncate font-mono text-xs font-medium" title={item.code}>
                                                {item.code}
                                            </TableCell>
                                            <TableCell className="truncate font-medium" title={item.name}>
                                                <Link to={`/syllabuses/${item.id}`} className="hover:underline">{item.name}</Link>
                                            </TableCell>
                                            <TableCell className="text-center tabular-nums">{item.sectionCount}</TableCell>
                                            <TableCell>
                                                <Badge variant={published ? "secondary" : "outline"}>
                                                    {published && <LockKeyhole className="mr-1 size-3" />}
                                                    {published ? "Published" : "Draft"}
                                                </Badge>
                                                {!item.isActive && (
                                                    <Badge variant="outline" className="ml-1">Inactive</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <div className="space-y-1">
                                                    <span className="text-xs font-medium tabular-nums">{item.completionPercent}%</span>
                                                    <Progress value={item.completionPercent} className="h-1.5" />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button asChild size="icon-sm" variant="outline" title="View Syllabus">
                                                        <Link to={`/syllabuses/${item.id}`} aria-label={`View ${item.name}`}><Eye className="size-4" /></Link>
                                                    </Button>
                                                    {canEdit && !published && (
                                                        <Button size="icon-sm" variant="outline" title="Edit Syllabus"
                                                            aria-label={`Edit ${item.name}`} onClick={() => openEdit(item)}>
                                                            <Pencil className="size-4" />
                                                        </Button>
                                                    )}
                                                    {canDelete && !published && (
                                                        <Button size="icon-sm" variant="outline" className="text-destructive hover:text-destructive"
                                                            title="Delete Syllabus" aria-label={`Delete ${item.name}`}
                                                            onClick={() => setDeleting(item)}>
                                                            <Trash2 className="size-4" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {rows.length === 0 && (
                                    <TableRow><TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                                        {search.trim() || status !== "all" ? "No matching syllabuses." : "No syllabuses yet."}
                                    </TableCell></TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ) : (
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {paged.map((item, index) => {
                            const published = item.status === "PUBLISHED";
                            return (
                                <article key={item.id} className="flex min-h-60 flex-col gap-3 rounded-md border bg-card p-4">
                                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                                        <span>#{effectivePage * pageSize + index + 1}</span>
                                        <Badge variant={published ? "secondary" : "outline"}>{published ? "Published" : "Draft"}</Badge>
                                    </div>
                                    <div className="min-w-0 space-y-1">
                                        <p className="break-all font-mono text-xs text-muted-foreground">{item.code}</p>
                                        <Link to={`/syllabuses/${item.id}`} className="block font-semibold hover:underline">{item.name}</Link>
                                    </div>
                                    <p className="text-sm text-muted-foreground">{item.sectionCount} section(s){!item.isActive ? " · Inactive" : ""}</p>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs"><span className="text-muted-foreground">Completion</span><span className="font-medium tabular-nums">{item.completionPercent}%</span></div>
                                        <Progress value={item.completionPercent} className="h-1.5" />
                                    </div>
                                    <div className="mt-auto flex flex-wrap gap-2 border-t pt-3">
                                        <Button asChild size="sm" variant="outline"><Link to={`/syllabuses/${item.id}`}><Eye className="size-4" /> Detail</Link></Button>
                                        {canEdit && !published && (
                                            <Button size="sm" variant="outline" onClick={() => openEdit(item)}><Pencil className="size-4" /> Edit</Button>
                                        )}
                                        {canDelete && !published && (
                                            <Button size="sm" variant="outline" className="text-destructive hover:text-destructive"
                                                onClick={() => setDeleting(item)}><Trash2 className="size-4" /> Delete</Button>
                                        )}
                                    </div>
                                </article>
                            );
                        })}
                        {rows.length === 0 && (
                            <div className="col-span-full rounded-md border bg-card p-10 text-center text-sm text-muted-foreground">
                                {search.trim() || status !== "all" ? "No matching syllabuses." : "No syllabuses yet."}
                            </div>
                        )}
                    </div>
                )}

                {!query.isPending && !query.isError && (
                    <SyllabusListFooter
                        count={rows.length}
                        page={effectivePage}
                        pageSize={pageSize}
                        onPageChange={setPage}
                        onPageSizeChange={(value) => { setPageSize(value); setPage(0); }}
                    />
                )}

                {/* CREATE / EDIT: shared field-level validation */}
                <FormModal
                    open={formOpen}
                    onClose={(open) => {
                        if (busy) return;

                        setFormOpen(open);

                        if (!open) {
                            setServerErrors({});
                        }
                    }}
                    schema={syllabusSchema}
                    title={
                        editing
                            ? "Edit Syllabus"
                            : "Create Syllabus"
                    }
                    initial={editing ?? undefined}
                    isSubmitting={busy}
                    fieldErrors={serverErrors}
                    onSubmit={(values: Record<string, unknown>) =>
                        void save(values)
                    }
                />

                {/* DELETE CONFIRMATION */}
                <ConfirmDialog
                    open={deleting !== null}
                    title="Delete Syllabus?"
                    description="Syllabuses containing CLOs, Sections or Materials cannot be deleted."
                    confirmLabel="Delete"
                    onCancel={() => {
                        if (!busy) setDeleting(null);
                    }}
                    onConfirm={() => void remove()}
                    loading={busy}
                />
            </div>
        </MainLayout>
    );
}
