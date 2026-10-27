import { useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

import {
    syllabusApi,
    type SyllabusClo,
    type SyllabusMaterial,
    type SyllabusMaterialInput,
    type SyllabusMaterialType,
} from "@/api/features/demo/syllabus.api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";

function errorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | {
            message?: string;
            errors?: Record<string, string[]>;
        }
            | undefined;

        const fieldError = data?.errors &&
            Object.values(data.errors).flat()[0];

        if (typeof fieldError === "string") {
            return fieldError;
        }

        if (typeof data?.message === "string") {
            return data.message;
        }

        if (error.response?.status === 403) {
            return "You do not have permission to perform this action.";
        }

        if (error.response?.status === 404) {
            return "The requested record was not found.";
        }
    }

    return "Operation failed. Please try again.";
}

function clean(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

// ==========================================
// CLO MANAGEMENT
// ==========================================

export function CloPanel({
                             syllabusId,
                             readOnly = false,
                         }: {
    syllabusId: number;
    readOnly?: boolean;
}) {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();

    const canCreate = !readOnly && hasPermission("SYLLABUS_CREATE");
    const canEdit = !readOnly && hasPermission("SYLLABUS_UPDATE");
    const canDelete = !readOnly && hasPermission("SYLLABUS_DELETE");

    const [open, setOpen] = useState(false);
    const [editing, setEditing] = useState<SyllabusClo | null>(null);
    const [details, setDetails] = useState("");
    const [deleting, setDeleting] = useState<SyllabusClo | null>(null);
    const [busy, setBusy] = useState(false);

    const query = useQuery({
        queryKey: ["syllabus-clos", syllabusId],
        queryFn: () => syllabusApi.listClos(syllabusId),
        enabled: Number.isSafeInteger(syllabusId) && syllabusId > 0,
    });

    const clos = query.data ?? [];

    async function refresh() {
        await Promise.all([
            qc.invalidateQueries({ queryKey: ["syllabus-clos", syllabusId] }),
            qc.invalidateQueries({ queryKey: ["syllabus-progress", syllabusId] }),
            qc.invalidateQueries({ queryKey: ["syllabuses"] }),
        ]);
    }

    function openCreate() {
        if (readOnly) return;
        setEditing(null);
        setDetails("");
        setOpen(true);
    }

    function openEdit(item: SyllabusClo) {
        if (readOnly) return;
        setEditing(item);
        setDetails(item.details);
        setOpen(true);
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy || readOnly) return;

        const value = clean(details);

        if (
            value.length < 10 ||
            value.length > 2000 ||
            !/\p{L}/u.test(value)
        ) {
            toast.error("CLO Details must contain letters (10-2000 characters).");
            return;
        }

        const duplicate = clos.some(
            (item) =>
                item.id !== editing?.id &&
                clean(item.details).toLowerCase() === value.toLowerCase()
        );

        if (duplicate) {
            toast.error("This CLO already exists.");
            return;
        }

        setBusy(true);

        try {
            if (editing) {
                await syllabusApi.updateClo(
                    syllabusId,
                    editing.id,
                    value
                );
            } else {
                await syllabusApi.createClo(syllabusId, value);
            }

            await refresh();
            setOpen(false);
            toast.success("CLO saved successfully.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!deleting || busy || readOnly) return;

        setBusy(true);

        try {
            await syllabusApi.deleteClo(syllabusId, deleting.id);
            await refresh();

            setDeleting(null);
            toast.success("CLO deleted successfully.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section className="w-full rounded-xl border bg-card p-5">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="text-xl font-semibold">Course Learning Outcomes</h2>
                    <p className="text-sm text-muted-foreground">
                        {clos.length} CLO(s)
                    </p>
                </div>

                {canCreate && (
                    <Button onClick={openCreate} disabled={busy}>
                        <Plus className="size-4" />
                        Add CLO
                    </Button>
                )}
            </div>

            {query.isPending ? (
                <p className="text-sm text-muted-foreground">Loading CLOs...</p>
            ) : query.isError ? (
                <div className="space-y-2">
                    <p className="text-sm text-destructive">
                        Could not load CLOs.
                    </p>

                    <Button
                        variant="outline"
                        onClick={() => void query.refetch()}
                    >
                        Retry
                    </Button>
                </div>
            ) : clos.length === 0 ? (
                <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
                    No CLOs yet.
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                        <tr className="border-b text-left">
                            <th className="w-24 p-3">CLO</th>
                            <th className="p-3">CLO Details</th>
                            {(canEdit || canDelete) && (
                                <th className="w-40 p-3 text-right">Actions</th>
                            )}
                        </tr>
                        </thead>

                        <tbody>
                        {clos.map((clo) => (
                            <tr key={clo.id} className="border-b last:border-0">
                                <td className="p-3 align-top font-semibold">
                                    {clo.code}
                                </td>

                                <td className="whitespace-pre-wrap p-3 align-top">
                                    {clo.details}
                                </td>

                                {(canEdit || canDelete) && (
                                    <td className="p-3 align-top">
                                        <div className="flex justify-end gap-2">
                                            {canEdit && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => openEdit(clo)}
                                                >
                                                    <Pencil className="size-4" />
                                                    Edit
                                                </Button>
                                            )}

                                            {canDelete && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => setDeleting(clo)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                open={open && !readOnly}
                title={editing ? `Edit ${editing.code}` : "Create CLO"}
                size="lg"
                onClose={() => {
                    if (!busy) setOpen(false);
                }}
            >
                <form onSubmit={(event) => void save(event)} className="space-y-4">
                    <div className="space-y-2">
                        <label htmlFor="clo-details" className="text-sm font-medium">
                            CLO Details *
                        </label>

                        <textarea
                            id="clo-details"
                            className="min-h-32 w-full rounded-md border bg-background p-3 text-sm"
                            value={details}
                            maxLength={2000}
                            required
                            disabled={busy}
                            placeholder="Describe the expected learning outcome"
                            onChange={(event) => setDetails(event.target.value)}
                        />

                        <p className="text-xs text-muted-foreground">
                            CLO code is generated automatically.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button type="submit" disabled={busy}>
                            {busy ? "Saving..." : "Save CLO"}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deleting && !readOnly}
                title="Delete CLO?"
                description={`Delete ${deleting?.code ?? "this CLO"}?`}
                loading={busy}
                onCancel={() => {
                    if (!busy) setDeleting(null);
                }}
                onConfirm={() => void remove()}
            />
        </section>
    );
}

// ==========================================
// LEARNING MATERIALS
// ==========================================


function automaticMaterialTitle(rawUrl: string): string {
    const parsed = new URL(rawUrl);
    const domain = parsed.hostname.replace(/^www\./i, "");

    const pathParts = parsed.pathname
        .split("/")
        .filter(Boolean)
        .map((part) => {
            let decoded = part;

            try {
                decoded = decodeURIComponent(part);
            } catch {
                // Use the original path segment.
            }

            return decoded
                .replace(/\.(pdf|html?|docx?|pptx?|mp4|txt)$/i, "")
                .replace(/[-_]+/g, " ")
                .replace(/\s+/g, " ")
                .trim();
        })
        .filter(Boolean);

    const description = pathParts.slice(-3).join(" / ");

    return (
        description ? `${domain} — ${description}` : domain
    ).slice(0, 200);
}

const emptyMaterial: SyllabusMaterialInput = {
    title: "",
    type: "DOCUMENT",
    url: "",
    author: "",
    publisher: "",
    mainMaterial: false,
    note: "",
    topicId: null,
};

const materialTypes: SyllabusMaterialType[] = [
    "DOCUMENT",
    "SLIDE",
    "VIDEO",
    "BOOK",
    "LINK",
];

export function MaterialsPanel({
                                   syllabusId,
                                   topicId = null,
                                   readOnly = false,
                               }: {
    syllabusId: number;
    topicId?: number | null;
    readOnly?: boolean;
}) {
    const qc = useQueryClient();
    const { hasPermission } = usePermissions();

    const canCreate = !readOnly && hasPermission("SYLLABUS_CREATE");
    const canEdit = !readOnly && hasPermission("SYLLABUS_UPDATE");
    const canDelete = !readOnly && hasPermission("SYLLABUS_DELETE");

    const scopedTopicId = topicId ?? null;
    const insideTopic = scopedTopicId !== null;

    const [open, setOpen] = useState(false);
    const [editing, setEditing] =
        useState<SyllabusMaterial | null>(null);

    const [form, setForm] =
        useState<SyllabusMaterialInput>({ ...emptyMaterial });

    const [deleting, setDeleting] =
        useState<SyllabusMaterial | null>(null);

    const [busy, setBusy] = useState(false);

    const query = useQuery({
        queryKey: ["syllabus-materials", syllabusId],
        queryFn: () => syllabusApi.listMaterials(syllabusId),
        enabled: Number.isSafeInteger(syllabusId) && syllabusId > 0,
    });

    const allMaterials = query.data ?? [];

    // Only show materials belonging to this Topic.
    // null means materials shared by the whole Syllabus.
    const visibleMaterials = allMaterials.filter(
        (item) => (item.topicId ?? null) === scopedTopicId
    );

    async function refresh() {
        await Promise.all([
            qc.invalidateQueries({ queryKey: ["syllabus-materials", syllabusId] }),
            qc.invalidateQueries({ queryKey: ["syllabus-progress", syllabusId] }),
            qc.invalidateQueries({ queryKey: ["syllabuses"] }),
        ]);
    }

    function openCreate() {
        if (readOnly) return;
        setEditing(null);
        setForm({
            ...emptyMaterial,
            topicId: scopedTopicId,
        });
        setOpen(true);
    }

    function openEdit(item: SyllabusMaterial) {
        if (readOnly) return;
        setEditing(item);

        setForm({
            title: item.title,
            type: item.type,
            url: item.url,
            author: item.author ?? "",
            publisher: item.publisher ?? "",
            mainMaterial: item.mainMaterial,
            note: item.note ?? "",
            topicId: scopedTopicId,
        });

        setOpen(true);
    }

    function update<K extends keyof SyllabusMaterialInput>(
        field: K,
        value: SyllabusMaterialInput[K]
    ) {
        setForm((previous) => ({
            ...previous,
            [field]: value,
        }));
    }

    async function save(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (busy || readOnly) return;

        const url = form.url.trim();

        if (!url || url.length > 2048) {
            toast.error("URL is required (max 2048 characters).");
            return;
        }

        try {
            const parsed = new URL(url);

            if (
                !["http:", "https:"].includes(parsed.protocol) ||
                !parsed.hostname ||
                parsed.username ||
                parsed.password
            ) {
                throw new Error("Invalid URL");
            }
        } catch {
            toast.error("Enter a valid HTTP or HTTPS URL.");
            return;
        }

        if (
            form.author.length > 150 ||
            form.publisher.length > 150 ||
            form.note.length > 1000
        ) {
            toast.error("Author, Publisher or Note is too long.");
            return;
        }

        // Auto-generate the required backend title from the URL.
        const title = automaticMaterialTitle(url);

        const duplicate = allMaterials.some(
            (item) =>
                item.id !== editing?.id &&
                item.url.trim().toLowerCase() === url.toLowerCase() &&
                (item.topicId ?? null) === scopedTopicId
        );

        if (duplicate) {
            toast.error("This URL already exists in the selected Topic.");
            return;
        }

        const payload: SyllabusMaterialInput = {
            title,
            type: form.type,
            url,
            author: clean(form.author),
            publisher: clean(form.publisher),
            mainMaterial: form.mainMaterial,
            note: form.note.trim(),
            topicId: scopedTopicId,
        };

        setBusy(true);

        try {
            if (editing) {
                await syllabusApi.updateMaterial(
                    syllabusId,
                    editing.id,
                    payload
                );
            } else {
                await syllabusApi.createMaterial(syllabusId, payload);
            }

            await refresh();
            setOpen(false);

            toast.success("Learning Material saved successfully.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!deleting || busy || readOnly) return;

        setBusy(true);

        try {
            await syllabusApi.deleteMaterial(
                syllabusId,
                deleting.id
            );

            setDeleting(null);
            await refresh();

            toast.success("Learning Material deleted.");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <section
            className={
                insideTopic
                    ? "mt-3 rounded-lg border bg-background/50 p-3"
                    : "w-full rounded-xl border bg-card p-5"
            }
        >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3
                        className={
                            insideTopic
                                ? "text-sm font-semibold"
                                : "text-xl font-semibold"
                        }
                    >
                        {insideTopic
                            ? "Learning Materials"
                            : "General Learning Materials"}
                    </h3>

                    <p className="text-xs text-muted-foreground">
                        {visibleMaterials.length} material(s)
                    </p>
                </div>

                {canCreate && (
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={busy}
                        onClick={openCreate}
                    >
                        <Plus className="size-4" />
                        Add Material
                    </Button>
                )}
            </div>

            {query.isPending ? (
                <p className="text-sm text-muted-foreground">
                    Loading Learning Materials...
                </p>
            ) : query.isError ? (
                <div className="space-y-2">
                    <p className="text-sm text-destructive">
                        Could not load Learning Materials.
                    </p>

                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void query.refetch()}
                    >
                        Retry
                    </Button>
                </div>
            ) : visibleMaterials.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                    {insideTopic
                        ? "No materials for this Topic yet."
                        : "No general materials yet."}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-sm">
                        <thead>
                        <tr className="border-b text-left">
                            <th className="p-2">Material</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Main</th>

                            {(canEdit || canDelete) && (
                                <th className="p-2 text-right">Actions</th>
                            )}
                        </tr>
                        </thead>

                        <tbody>
                        {visibleMaterials.map((item) => (
                            <tr
                                key={item.id}
                                className="border-b last:border-0"
                            >
                                <td className="p-2 align-top">
                                    <a
                                        href={item.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-start gap-1 break-all text-primary underline-offset-4 hover:underline"
                                    >
                                        {item.title}
                                        <ExternalLink className="mt-1 size-3 shrink-0" />
                                    </a>

                                    {item.note && (
                                        <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                                            {item.note}
                                        </p>
                                    )}
                                </td>

                                <td className="p-2 align-top">
                                    {item.type}
                                </td>

                                <td className="p-2 align-top">
                                    {item.mainMaterial ? "Yes" : "No"}
                                </td>

                                {(canEdit || canDelete) && (
                                    <td className="p-2 align-top">
                                        <div className="flex justify-end gap-2">
                                            {canEdit && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={busy}
                                                    onClick={() => openEdit(item)}
                                                >
                                                    <Pencil className="size-4" />
                                                    Edit
                                                </Button>
                                            )}

                                            {canDelete && (
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    disabled={busy}
                                                    onClick={() => setDeleting(item)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            )}
                                        </div>
                                    </td>
                                )}
                            </tr>
                        ))}
                        </tbody>
                    </table>
                </div>
            )}

            <Modal
                open={open && !readOnly}
                title={
                    editing
                        ? "Edit Learning Material"
                        : "Add Learning Material"
                }
                size="lg"
                onClose={() => {
                    if (!busy) setOpen(false);
                }}
            >
                <form
                    onSubmit={(event) => void save(event)}
                    className="max-h-[70vh] space-y-4 overflow-y-auto pr-2"
                >
                    <div className="space-y-1">
                        <label
                            htmlFor={`material-type-${topicId ?? "general"}`}
                            className="text-sm font-medium"
                        >
                            Material Type *
                        </label>

                        <select
                            id={`material-type-${topicId ?? "general"}`}
                            className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                            value={form.type}
                            disabled={busy}
                            onChange={(event) =>
                                update(
                                    "type",
                                    event.target.value as SyllabusMaterialType
                                )
                            }
                        >
                            {materialTypes.map((type) => (
                                <option key={type} value={type}>
                                    {type}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-1">
                        <label
                            htmlFor={`material-url-${topicId ?? "general"}`}
                            className="text-sm font-medium"
                        >
                            Material URL *
                        </label>

                        <Input
                            id={`material-url-${topicId ?? "general"}`}
                            type="url"
                            value={form.url}
                            required
                            maxLength={2048}
                            disabled={busy}
                            placeholder="https://..."
                            onChange={(event) =>
                                update("url", event.target.value)
                            }
                        />

                        <p className="text-xs text-muted-foreground">
                            The display name is generated automatically from the URL.
                        </p>
                    </div>

                    <p className="rounded-md border p-2 text-xs text-muted-foreground">
                        {insideTopic
                            ? "This material will be linked to the selected Topic."
                            : "This material will be available for the whole Syllabus."}
                    </p>

                    <details className="rounded-md border p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                            More Details (optional)
                        </summary>

                        <div className="mt-4 space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1">
                                    <label
                                        htmlFor={`material-author-${topicId ?? "general"}`}
                                        className="text-sm font-medium"
                                    >
                                        Author
                                    </label>

                                    <Input
                                        id={`material-author-${topicId ?? "general"}`}
                                        value={form.author}
                                        maxLength={150}
                                        disabled={busy}
                                        onChange={(event) =>
                                            update("author", event.target.value)
                                        }
                                    />
                                </div>

                                <div className="space-y-1">
                                    <label
                                        htmlFor={`material-publisher-${topicId ?? "general"}`}
                                        className="text-sm font-medium"
                                    >
                                        Publisher
                                    </label>

                                    <Input
                                        id={`material-publisher-${topicId ?? "general"}`}
                                        value={form.publisher}
                                        maxLength={150}
                                        disabled={busy}
                                        onChange={(event) =>
                                            update("publisher", event.target.value)
                                        }
                                    />
                                </div>
                            </div>

                            <div className="space-y-1">
                                <label
                                    htmlFor={`material-note-${topicId ?? "general"}`}
                                    className="text-sm font-medium"
                                >
                                    Note
                                </label>

                                <textarea
                                    id={`material-note-${topicId ?? "general"}`}
                                    className="min-h-24 w-full rounded-md border bg-background p-3 text-sm"
                                    value={form.note}
                                    maxLength={1000}
                                    disabled={busy}
                                    onChange={(event) =>
                                        update("note", event.target.value)
                                    }
                                />
                            </div>
                        </div>
                    </details>

                    <label className="flex items-center gap-2 text-sm">
                        <input
                            type="checkbox"
                            checked={form.mainMaterial}
                            disabled={busy}
                            onChange={(event) =>
                                update("mainMaterial", event.target.checked)
                            }
                        />
                        Main Material
                    </label>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button type="submit" disabled={busy}>
                            {busy ? "Saving..." : "Save Material"}
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmDialog
                open={!!deleting && !readOnly}
                title="Delete Learning Material?"
                description={`Delete "${deleting?.title ?? "this material"}"?`}
                loading={busy}
                onCancel={() => {
                    if (!busy) setDeleting(null);
                }}
                onConfirm={() => void remove()}
            />
        </section>
    );
}
