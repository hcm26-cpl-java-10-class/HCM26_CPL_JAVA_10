
import { useState, type FormEvent } from "react";
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
    Search,
    Trash2,
    X,
} from "lucide-react";

import {
    syllabusApi,
    type SyllabusInput,
    type SyllabusSummary,
} from "@/api/features/demo/syllabus.api";

import { MainLayout } from "@/components/layout/MainLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { CatalogPagination } from "@/pages/management/demo/course/components/CatalogPagination";
import { useDebouncedValue } from "@/pages/management/demo/course/hooks/useDebouncedValue";
import { usePermissions } from "@/hooks/usePermissions";
import { SyllabusImportAction } from "./SyllabusImportAction";

const BLANK: SyllabusInput = {
    code: "",
    name: "",
    description: "",
};

const PAGE_SIZE = 10;
const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ");

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

    const [form, setForm] = useState<SyllabusInput>({
        ...BLANK,
    });

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
            sortBy === "code"
                ? a.code.localeCompare(b.code)
                : a.name.localeCompare(b.name)
    );

    const totalPages = Math.ceil(
        rows.length / PAGE_SIZE
    );

    const effectivePage = Math.min(
        page,
        Math.max(0, totalPages - 1)
    );

    const paged = rows.slice(
        effectivePage * PAGE_SIZE,
        (effectivePage + 1) * PAGE_SIZE
    );

    const draftCount = all.filter(
        (s) => s.status === "DRAFT"
    ).length;

    const publishedCount = all.filter(
        (s) => s.status === "PUBLISHED"
    ).length;

    function openCreate() {
        setEditing(null);
        setForm({ ...BLANK });
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

        setForm({
            code: item.code,
            name: item.name,
            description: item.description ?? "",
        });

        setFormOpen(true);
    }

    async function refreshList() {
        await qc.invalidateQueries({
            queryKey: ["syllabuses"],
        });
    }

    async function save(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (busy) return;

        if (editing?.status === "PUBLISHED") {
            toast.error(
                "Published Syllabus is read-only."
            );
            return;
        }

        const clean: SyllabusInput = {
            code: form.code.trim().toUpperCase(),
            name: normalize(form.name),
            description: form.description.trim(),
        };

        if (
            !/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(
                clean.code
            )
        ) {
            toast.error(
                "Code must contain 3–30 valid characters."
            );
            return;
        }

        if (
            clean.name.length < 3 ||
            clean.name.length > 150 ||
            !/\p{L}/u.test(clean.name)
        ) {
            toast.error(
                "Name must contain letters and have 3–150 characters."
            );
            return;
        }

        if (clean.description.length > 1500) {
            toast.error("Description is too long.");
            return;
        }

        const duplicate = all.some(
            (item) =>
                item.id !== editing?.id &&
                (
                    item.code.toLowerCase() ===
                    clean.code.toLowerCase() ||
                    normalize(item.name).toLowerCase() ===
                    clean.name.toLowerCase()
                )
        );

        if (duplicate) {
            toast.error(
                "Syllabus code or name already exists."
            );
            return;
        }

        setBusy(true);

        try {
            if (editing) {
                await syllabusApi.update(
                    editing.id,
                    clean
                );
            } else {
                await syllabusApi.create(clean);
            }

            await refreshList();
            setFormOpen(false);

            toast.success(
                "Syllabus saved successfully."
            );
        } catch (error) {
            toast.error(errorMessage(error));
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
            <div className="mx-auto w-full max-w-7xl space-y-6 pb-10">
                {/* PAGE HEADER */}
                <header className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight">
                            Syllabuses
                        </h1>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Create, manage and publish course outlines.
                        </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {import.meta.env.DEV && canCreate && canEdit && <SyllabusImportAction />}

                        {canCreate && (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" />
                                Create Syllabus
                            </Button>
                        )}
                    </div>
                </header>

                {/* OVERVIEW */}
                <section
                    className="grid gap-3 sm:grid-cols-3"
                    aria-label="Syllabus overview"
                >
                    {(
                        [
                            [
                                "Total syllabuses",
                                all.length,
                            ],
                            ["Draft", draftCount],
                            ["Published", publishedCount],
                        ] as const
                    ).map(([label, value]) => (
                        <div
                            key={label}
                            className="rounded-2xl border bg-card p-4"
                        >
                            <p className="text-xs text-muted-foreground">
                                {label}
                            </p>

                            <p className="mt-1 text-2xl font-semibold tabular-nums">
                                {value}
                            </p>
                        </div>
                    ))}
                </section>

                {/* SEARCH, FILTER AND SORT */}
                <section className="grid gap-3 rounded-2xl border bg-card p-4 md:grid-cols-[minmax(0,1fr)_170px_170px]">
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

                        <Input
                            aria-label="Search syllabus name or code"
                            value={search}
                            placeholder="Search by code or syllabus name..."
                            className="pl-9 pr-9"
                            onChange={(event) => {
                                setSearch(
                                    event.target.value
                                );
                                setPage(0);
                            }}
                        />

                        {search && (
                            <button
                                type="button"
                                aria-label="Clear search"
                                onClick={() => {
                                    setSearch("");
                                    setPage(0);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                                <X className="size-4" />
                            </button>
                        )}
                    </div>

                    <Select
                        value={status}
                        onValueChange={(value) => {
                            setStatus(value);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger
                            aria-label="Filter status"
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                            <SelectItem value="all">
                                All statuses
                            </SelectItem>

                            <SelectItem value="DRAFT">
                                Draft
                            </SelectItem>

                            <SelectItem value="PUBLISHED">
                                Published
                            </SelectItem>
                        </SelectContent>
                    </Select>

                    <Select
                        value={sortBy}
                        onValueChange={(value) => {
                            setSortBy(value);
                            setPage(0);
                        }}
                    >
                        <SelectTrigger
                            aria-label="Sort syllabuses"
                            className="w-full"
                        >
                            <SelectValue />
                        </SelectTrigger>

                        <SelectContent>
                            <SelectItem value="name">
                                Name (A–Z)
                            </SelectItem>

                            <SelectItem value="code">
                                Code (A–Z)
                            </SelectItem>
                        </SelectContent>
                    </Select>
                </section>

                <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {query.isPending
                ? "Loading..."
                : `${rows.length} syllabuses found`}
          </span>

                    {(search || status !== "all") && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                setSearch("");
                                setStatus("all");
                                setPage(0);
                            }}
                        >
                            Clear filters
                        </Button>
                    )}
                </div>

                {/* SYLLABUS TABLE */}
                {query.isPending ? (
                    <div className="rounded-2xl border bg-card p-8 text-sm text-muted-foreground">
                        Loading syllabuses...
                    </div>
                ) : query.isError ? (
                    <div
                        role="alert"
                        className="space-y-3 rounded-2xl border bg-card p-6"
                    >
                        <p>Could not load syllabuses.</p>

                        <Button
                            variant="outline"
                            onClick={() =>
                                void query.refetch()
                            }
                        >
                            Try again
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-2xl border bg-card">
                        <table className="w-full min-w-[850px] text-sm">
                            <thead className="bg-muted/40 text-left">
                            <tr>
                                <th scope="col" className="p-3">
                                    Code
                                </th>
                                <th scope="col" className="p-3">
                                    Name
                                </th>
                                <th scope="col" className="p-3">
                                    Sections
                                </th>
                                <th scope="col" className="p-3">
                                    Status
                                </th>
                                <th scope="col" className="p-3">
                                    Completion
                                </th>
                                <th scope="col" className="p-3">
                                    Actions
                                </th>
                            </tr>
                            </thead>

                            <tbody>
                            {paged.map((item) => {
                                const published =
                                    item.status === "PUBLISHED";

                                return (
                                    <tr
                                        key={item.id}
                                        className="border-t hover:bg-muted/20"
                                    >
                                        <td className="p-3 font-mono text-xs font-semibold">
                                            {item.code}
                                        </td>

                                        <td className="p-3 font-medium">
                                            {item.name}
                                        </td>

                                        <td className="p-3 tabular-nums">
                                            {item.sectionCount}
                                        </td>

                                        <td className="p-3">
                                            <Badge
                                                variant={
                                                    published
                                                        ? "secondary"
                                                        : "outline"
                                                }
                                            >
                                                {published && (
                                                    <LockKeyhole className="mr-1 size-3" />
                                                )}

                                                {published
                                                    ? "Published"
                                                    : "Draft"}
                                            </Badge>

                                            {!item.isActive && (
                                                <Badge
                                                    variant="outline"
                                                    className="ml-2"
                                                >
                                                    Inactive
                                                </Badge>
                                            )}
                                        </td>

                                        <td className="min-w-36 p-3">
                                            <div className="space-y-1">
                          <span className="text-xs font-medium tabular-nums">
                            {item.completionPercent}%
                          </span>

                                                <Progress
                                                    value={
                                                        item.completionPercent
                                                    }
                                                    className="h-2"
                                                />
                                            </div>
                                        </td>

                                        <td className="p-3">
                                            <div className="flex flex-wrap gap-2">
                                                <Button
                                                    asChild
                                                    size="sm"
                                                    variant="outline"
                                                >
                                                    <Link
                                                        to={`/syllabuses/${item.id}`}
                                                    >
                                                        <Eye className="size-4" />
                                                        Detail
                                                    </Link>
                                                </Button>

                                                {canEdit &&
                                                    !published && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            onClick={() =>
                                                                openEdit(item)
                                                            }
                                                        >
                                                            <Pencil className="size-4" />
                                                            Edit
                                                        </Button>
                                                    )}

                                                {canDelete &&
                                                    !published && (
                                                        <Button
                                                            size="sm"
                                                            variant="destructive"
                                                            onClick={() =>
                                                                setDeleting(item)
                                                            }
                                                        >
                                                            <Trash2 className="size-4" />
                                                            Delete
                                                        </Button>
                                                    )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            </tbody>
                        </table>

                        {rows.length === 0 && (
                            <div className="p-10 text-center text-sm text-muted-foreground">
                                {search.trim() ||
                                status !== "all"
                                    ? "No matching syllabuses."
                                    : "No syllabuses yet."}
                            </div>
                        )}
                    </div>
                )}

                <CatalogPagination
                    page={effectivePage}
                    totalPages={totalPages}
                    onPageChange={setPage}
                />

                {/* CREATE / EDIT */}
                <Modal
                    title={
                        editing
                            ? "Edit Syllabus"
                            : "Create Syllabus"
                    }
                    open={formOpen}
                    onClose={() => {
                        if (!busy) setFormOpen(false);
                    }}
                >
                    <form
                        className="space-y-4"
                        onSubmit={(event) =>
                            void save(event)
                        }
                    >
                        <div>
                            <label
                                htmlFor="syllabus-code"
                                className="mb-1 block text-sm font-medium"
                            >
                                Syllabus Code
                            </label>

                            <Input
                                id="syllabus-code"
                                required
                                maxLength={30}
                                value={form.code}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        code: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="syllabus-name"
                                className="mb-1 block text-sm font-medium"
                            >
                                Syllabus Name
                            </label>

                            <Input
                                id="syllabus-name"
                                required
                                maxLength={150}
                                value={form.name}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        name: event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="syllabus-description"
                                className="mb-1 block text-sm font-medium"
                            >
                                Description
                            </label>

                            <textarea
                                id="syllabus-description"
                                rows={4}
                                maxLength={1500}
                                className="w-full rounded-md border bg-background p-2"
                                value={form.description}
                                onChange={(event) =>
                                    setForm((previous) => ({
                                        ...previous,
                                        description:
                                        event.target.value,
                                    }))
                                }
                            />
                        </div>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                    setFormOpen(false)
                                }
                            >
                                Cancel
                            </Button>

                            <Button
                                type="submit"
                                disabled={busy}
                            >
                                Save
                            </Button>
                        </div>
                    </form>
                </Modal>

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
