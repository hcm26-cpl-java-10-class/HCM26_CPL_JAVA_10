
import {
    useRef,
    useState,
    type FormEvent,
} from "react";
import { Link } from "react-router-dom";
import {
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";

import {
    Search,
    Plus,
    Eye,
    Pencil,
    Trash2,
    Upload,
    LockKeyhole,
} from "lucide-react";

import {
    syllabusApi,
    type SyllabusInput,
    type SyllabusSummary,
} from "@/api/features/demo/syllabus.api";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";

const empty: SyllabusInput = {
    code: "",
    name: "",
    description: "",
};

const normalize = (value: string) =>
    value.trim().replace(/\s+/g, " ");

function errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | {
            errors?: Record<string, string[]>;
            message?: string;
            detail?: string;
        }
            | undefined;

        const firstError = data?.errors
            ? Object.values(data.errors).flat()[0]
            : undefined;

        if (typeof firstError === "string") {
            return firstError;
        }

        if (typeof data?.detail === "string") {
            return data.detail;
        }

        if (typeof data?.message === "string") {
            return data.message;
        }

        if (error.response?.status === 403) {
            return "You do not have permission to perform this action.";
        }
    }

    return "Operation failed. Check the Backend connection.";
}

export default function SyllabusesPage() {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();

    const canCreate = hasPermission("SYLLABUS_CREATE");
    const canEdit = hasPermission("SYLLABUS_UPDATE");
    const canDelete = hasPermission("SYLLABUS_DELETE");

    const [search, setSearch] = useState("");
    const [form, setForm] = useState<SyllabusInput>({
        ...empty,
    });

    const [editing, setEditing] =
        useState<SyllabusSummary | null>(null);

    const [formOpen, setFormOpen] = useState(false);

    const [deleting, setDeleting] =
        useState<SyllabusSummary | null>(null);

    const [busy, setBusy] = useState(false);
    const [importing, setImporting] = useState(false);

    const importInputRef = useRef<HTMLInputElement>(null);

    const query = useQuery({
        queryKey: ["syllabuses", search.trim()],
        queryFn: () => syllabusApi.list(search.trim()),
    });

    const results = query.data ?? [];

    const suggestions =
        search.trim().length > 0
            ? results.slice(0, 5)
            : [];

    function openCreate() {
        setEditing(null);
        setForm({ ...empty });
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

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy) return;

        if (editing?.status === "PUBLISHED") {
            toast.error("Published Syllabus is read-only.");
            return;
        }

        const clean: SyllabusInput = {
            code: form.code.trim().toUpperCase(),
            name: normalize(form.name),
            description: form.description.trim(),
        };

        if (
            !/^[A-Z0-9][A-Z0-9_-]{2,29}$/.test(clean.code)
        ) {
            toast.error(
                "Code must contain 3-30 valid characters."
            );
            return;
        }

        if (
            clean.name.length < 3 ||
            clean.name.length > 150 ||
            !/\p{L}/u.test(clean.name)
        ) {
            toast.error(
                "Name must contain letters and have 3-150 characters."
            );
            return;
        }

        if (clean.description.length > 1500) {
            toast.error("Description is too long.");
            return;
        }

        const duplicate = results.some(
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
            toast.success("Syllabus saved successfully.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!deleting || busy) return;

        if (deleting.status === "PUBLISHED") {
            toast.error("Published Syllabus cannot be deleted.");
            return;
        }

        setBusy(true);

        try {
            await syllabusApi.delete(deleting.id);
            await refreshList();

            setDeleting(null);
            toast.success("Syllabus deleted successfully.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function handleImportExcel(file: File) {
        if (importing) return;

        if (!file.name.toLowerCase().endsWith(".xlsx")) {
            toast.error("Please select an Excel .xlsx file.");
            return;
        }

        if (file.size > 5_000_000) {
            toast.error("File must be smaller than 5 MB.");
            return;
        }

        if (
            !window.confirm(
                "Import Excel demo data into the local database?"
            )
        ) {
            return;
        }

        setImporting(true);

        try {
            const result =
                await syllabusApi.importExcel(file);

            setSearch("");
            await refreshList();

            toast.success(
                `Import successful: ` +
                `${result.syllabuses} Syllabuses, ` +
                `${result.clos} CLOs, ` +
                `${result.sections} Sections, ` +
                `${result.topics} Topics, ` +
                `${result.materials} Materials.`
            );
        } catch (error) {
            if (
                axios.isAxiosError(error) &&
                error.response?.status === 403
            ) {
                toast.error(
                    "Import denied. Check permissions and the Backend demo-import flag."
                );
            } else {
                toast.error(errorMessage(error));
            }
        } finally {
            setImporting(false);
        }
    }

    return (
        <MainLayout
            pathName={{ syllabuses: "Syllabuses" }}
        >
            <div className="mx-auto w-full max-w-[1500px] space-y-6">
                {/* HEADER */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Syllabuses
                        </h1>
                        <p className="text-sm text-muted-foreground">
                            Create, manage and publish course outlines.
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {import.meta.env.DEV &&
                            canCreate &&
                            canEdit && (
                                <>
                                    <input
                                        ref={importInputRef}
                                        type="file"
                                        accept=".xlsx"
                                        className="hidden"
                                        aria-label="Import Syllabus Excel"
                                        onChange={(event) => {
                                            const file =
                                                event.currentTarget.files?.[0];

                                            event.currentTarget.value = "";

                                            if (file) {
                                                void handleImportExcel(file);
                                            }
                                        }}
                                    />

                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={importing}
                                        onClick={() =>
                                            importInputRef.current?.click()
                                        }
                                    >
                                        <Upload className="size-4" />
                                        {importing
                                            ? "Importing..."
                                            : "Import Excel"}
                                    </Button>
                                </>
                            )}

                        {canCreate && (
                            <Button onClick={openCreate}>
                                <Plus className="size-4" />
                                Create Syllabus
                            </Button>
                        )}
                    </div>
                </div>

                {/* SEARCH */}
                <div className="rounded-xl border bg-card p-4">
                    <label
                        htmlFor="syllabus-search"
                        className="mb-2 block text-sm font-semibold"
                    >
                        Search by syllabus name or code
                    </label>

                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />

                        <Input
                            id="syllabus-search"
                            value={search}
                            placeholder="e.g. Java, JNP119, Spring"
                            className="pl-9"
                            onChange={(event) =>
                                setSearch(event.target.value)
                            }
                        />

                        {suggestions.length > 0 && (
                            <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border bg-card shadow-lg">
                                {suggestions.map((item) => (
                                    <Link
                                        key={item.id}
                                        to={`/syllabuses/${item.id}`}
                                        className="block p-2 text-sm hover:bg-muted"
                                    >
                                        {item.code} — {item.name}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* TABLE */}
                {query.isPending ? (
                    <p>Loading Syllabuses...</p>
                ) : query.isError ? (
                    <div
                        role="alert"
                        className="space-y-3 rounded-xl border p-4"
                    >
                        <p>Could not load Syllabuses.</p>

                        <Button
                            variant="outline"
                            onClick={() =>
                                void query.refetch()
                            }
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-xl border bg-card">
                        <table className="w-full min-w-[850px] text-sm">
                            <thead className="bg-muted/40 text-left">
                            <tr>
                                <th className="p-3">Code</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">Sections</th>
                                <th className="p-3">Status</th>
                                <th className="p-3">Completion</th>
                                <th className="p-3">Actions</th>
                            </tr>
                            </thead>

                            <tbody>
                            {results.map((item) => {
                                const published =
                                    item.status === "PUBLISHED";

                                return (
                                    <tr
                                        key={item.id}
                                        className="border-t"
                                    >
                                        <td className="p-3 font-medium">
                                            {item.code}
                                        </td>

                                        <td className="p-3">
                                            {item.name}
                                        </td>

                                        <td className="p-3">
                                            {item.sectionCount}
                                        </td>

                                        <td className="p-3">
                                                <span
                                                    className={
                                                        published
                                                            ? "inline-flex items-center gap-1 rounded-full border border-green-500/40 bg-green-500/10 px-2 py-1 text-xs text-green-700 dark:text-green-400"
                                                            : "inline-flex rounded-full border px-2 py-1 text-xs"
                                                    }
                                                >
                                                    {published && (
                                                        <LockKeyhole className="size-3" />
                                                    )}

                                                    {published
                                                        ? "Published"
                                                        : "Draft"}
                                                </span>
                                        </td>

                                        <td className="min-w-[140px] p-3">
                                            <div className="space-y-1">
                                                    <span className="text-xs font-semibold">
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

                                                {canEdit && !published && (
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

                                                {canDelete && !published && (
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

                        {results.length === 0 && (
                            <p className="p-8 text-center text-muted-foreground">
                                No Syllabuses found.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* CREATE / EDIT MODAL */}
            <Modal
                title={
                    editing
                        ? "Edit Syllabus"
                        : "Create Syllabus"
                }
                open={formOpen}
                onClose={() =>
                    !busy && setFormOpen(false)
                }
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
                            value={form.code}
                            maxLength={30}
                            required
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
                            value={form.name}
                            maxLength={150}
                            required
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
                            className="w-full rounded-md border bg-background p-2"
                            rows={4}
                            maxLength={1500}
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
                onCancel={() =>
                    !busy && setDeleting(null)
                }
                onConfirm={() =>
                    void remove()
                }
                loading={busy}
            />
        </MainLayout>
    );
}
