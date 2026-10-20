import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import axios from "axios";
import {
    Search,
    Plus,
    Eye,
    Pencil,
    Trash2,
} from "lucide-react";

import {
    syllabusApi,
    type SyllabusInput,
    type SyllabusSummary,
} from "@/api/features/demo/syllabus.api";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";

const empty: SyllabusInput = {
    code: "",
    name: "",
    description: "",
};

const normalize = (s: string) =>
    s.trim().replace(/\s+/g, " ");

function message(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const data = error.response?.data as
            | {
            errors?: Record<string, string[]>;
            message?: string;
        }
            | undefined;

        const first =
            data?.errors &&
            Object.values(data.errors).flat()[0];

        if (typeof first === "string") {
            return first;
        }

        if (typeof data?.message === "string") {
            return data.message;
        }

        if (error.response?.status === 403) {
            return "You do not have permission";
        }
    }

    return "Action failed. Check Backend connection and try again.";
}

export default function SyllabusesPage() {
    const qc = useQueryClient();

    const { hasPermission } = usePermissions();

    const [search, setSearch] = useState("");

    const [form, setForm] =
        useState<SyllabusInput>(empty);

    const [editing, setEditing] =
        useState<SyllabusSummary | null>(null);

    const [formOpen, setFormOpen] =
        useState(false);

    const [deleting, setDeleting] =
        useState<SyllabusSummary | null>(null);

    const [busy, setBusy] = useState(false);

    const canCreate = hasPermission(
        "SYLLABUS_CREATE"
    );

    const canEdit = hasPermission(
        "SYLLABUS_UPDATE"
    );

    const canDelete = hasPermission(
        "SYLLABUS_DELETE"
    );

    const query = useQuery({
        queryKey: ["syllabuses", search.trim()],
        queryFn: () =>
            syllabusApi.list(search.trim()),
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
        setEditing(item);

        setForm({
            code: item.code,
            name: item.name,
            description: item.description ?? "",
        });

        setFormOpen(true);
    }

    async function save(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (busy) return;

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
                "Code must have 3-30 letters/digits, _ or -"
            );
            return;
        }

        if (
            clean.name.length < 3 ||
            clean.name.length > 150 ||
            !/\p{L}/u.test(clean.name)
        ) {
            toast.error(
                "Name must contain letters and have 3-150 characters"
            );
            return;
        }

        if (clean.description.length > 1500) {
            toast.error("Description is too long");
            return;
        }

        const duplicate = results.some(
            (s) =>
                s.id !== editing?.id &&
                (
                    s.code.toLowerCase() ===
                    clean.code.toLowerCase() ||
                    normalize(s.name).toLowerCase() ===
                    clean.name.toLowerCase()
                )
        );

        if (duplicate) {
            toast.error(
                "Syllabus name or code already exists"
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

            await qc.invalidateQueries({
                queryKey: ["syllabuses"],
            });

            setFormOpen(false);

            toast.success("Syllabus saved");
        } catch (error) {
            toast.error(message(error));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!deleting || busy) return;

        setBusy(true);

        try {
            await syllabusApi.delete(deleting.id);

            await qc.invalidateQueries({
                queryKey: ["syllabuses"],
            });

            setDeleting(null);

            toast.success("Syllabus deleted");
        } catch (error) {
            toast.error(message(error));
        } finally {
            setBusy(false);
        }
    }

    return (
        <MainLayout
            pathName={{
                syllabuses: "Syllabuses",
            }}
        >
            <div className="mx-auto max-w-6xl space-y-6">
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Syllabuses
                        </h1>

                        <p className="text-sm text-muted-foreground">
                            Create outlines before creating courses.
                        </p>
                    </div>

                    {canCreate && (
                        <Button onClick={openCreate}>
                            <Plus className="size-4" />
                            Create Syllabus
                        </Button>
                    )}
                </div>

                {/* Search */}
                <div className="rounded-xl border bg-card p-4">
                    <label
                        htmlFor="syllabus-search"
                        className="mb-2 block text-sm font-medium"
                    >
                        Search by syllabus name or code
                    </label>

                    <div className="relative">
                        <Search className="absolute left-3 top-3 size-4 text-muted-foreground" />

                        <Input
                            id="syllabus-search"
                            className="pl-9"
                            placeholder="e.g. Java, JNP119, Spring"
                            value={search}
                            maxLength={100}
                            onChange={(e) =>
                                setSearch(e.target.value)
                            }
                            autoComplete="off"
                        />

                        {suggestions.length > 0 && (
                            <div className="absolute z-20 mt-1 w-full rounded-lg border bg-card shadow-lg">
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

                {/* Table */}
                {query.isLoading ? (
                    <p>Loading syllabuses...</p>
                ) : query.isError ? (
                    <div role="alert">
                        Could not load syllabuses.

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
                        <table className="w-full text-sm">
                            <thead className="bg-muted/40 text-left">
                            <tr>
                                <th className="p-3">Code</th>
                                <th className="p-3">Name</th>
                                <th className="p-3">Sections</th>
                                <th className="p-3">Actions</th>
                            </tr>
                            </thead>

                            <tbody>
                            {results.map((item) => (
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
                                        <div className="flex gap-2">
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

                                            {canEdit && (
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

                                            {canDelete && (
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
                            ))}
                            </tbody>
                        </table>

                        {results.length === 0 && (
                            <p className="p-8 text-center text-muted-foreground">
                                No syllabuses found.
                            </p>
                        )}
                    </div>
                )}
            </div>

            {/* Create / Edit Modal */}
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
                    onSubmit={(e) => void save(e)}
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
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    code: e.target.value,
                                }))
                            }

                            required
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
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    name: e.target.value,
                                }))
                            }

                            required
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
                            onChange={(e) =>
                                setForm((p) => ({
                                    ...p,
                                    description: e.target.value,
                                }))
                            }
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setFormOpen(false)
                            }
                            disabled={busy}
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

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={deleting !== null}
                title="Delete Syllabus?"
                description="Syllabuses containing sections cannot be deleted."
                confirmLabel="Delete"
                onCancel={() =>
                    !busy && setDeleting(null)
                }
                onConfirm={() => void remove()}
                loading={busy}
            />
        </MainLayout>
    );
}