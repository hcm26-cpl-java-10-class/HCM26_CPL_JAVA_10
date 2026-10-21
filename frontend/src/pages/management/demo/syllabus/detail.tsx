import GeneralInformationPanel from "./GeneralInformationPanel";
import { useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";

import {
    ArrowLeft,
    Plus,
    Pencil,
    Trash2,
    CheckCircle2,
} from "lucide-react";

import {
    syllabusApi,
    type SyllabusSection,
    type Topic,
    type SyllabusValidation,
} from "@/api/features/demo/syllabus.api";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { usePermissions } from "@/hooks/usePermissions";

const norm = (s: string) =>
    s.trim().replace(/\s+/g, " ");

const equal = (a: string, b: string) =>
    norm(a).toLocaleLowerCase("vi") ===
    norm(b).toLocaleLowerCase("vi");

function errorMessage(error: unknown) {
    if (axios.isAxiosError(error)) {
        const payload = error.response?.data as
            | {
            errors?: Record<string, string[]>;
            message?: string;
        }
            | undefined;

        const first =
            payload?.errors &&
            Object.values(payload.errors).flat()[0];

        if (typeof first === "string") {
            return first;
        }

        if (typeof payload?.message === "string") {
            return payload.message;
        }

        if (error.response?.status === 403) {
            return "Insufficient permissions";
        }
    }

    return "Operation failed. Please try again.";
}

export default function SyllabusDetailPage() {
    const { id } = useParams();

    const syllabusId = Number(id);

    const validId =
        Number.isSafeInteger(syllabusId) &&
        syllabusId > 0;

    const qc = useQueryClient();

    const { hasPermission } = usePermissions();

    const canAdd = hasPermission(
        "SYLLABUS_CREATE"
    );

    const canEdit = hasPermission(
        "SYLLABUS_UPDATE"
    );

    const canDelete = hasPermission(
        "SYLLABUS_DELETE"
    );

    const [sectionOpen, setSectionOpen] =
        useState(false);

    const [editingSection, setEditingSection] =
        useState<SyllabusSection | null>(null);

    const [sectionTitle, setSectionTitle] =
        useState("");

    const [sectionOrder, setSectionOrder] =
        useState("1");

    const [bulkOpen, setBulkOpen] =
        useState(false);

    const [bulkCount, setBulkCount] =
        useState(3);



    const [topicSection, setTopicSection] =
        useState<SyllabusSection | null>(null);

    const [editingTopic, setEditingTopic] =
        useState<Topic | null>(null);

    const [topicTitle, setTopicTitle] =
        useState("");

    const [confirm, setConfirm] =
        useState<{
            type: "section" | "topic";
            sectionId: number;
            topicId?: number;
        } | null>(null);

    const [validation, setValidation] =
        useState<SyllabusValidation | null>(null);

    const [busy, setBusy] =
        useState(false);

    const detailQuery = useQuery({
        queryKey: ["syllabus", syllabusId],
        queryFn: () =>
            syllabusApi.get(syllabusId),
        enabled: validId,
    });

    const syllabus = detailQuery.data;

    const sections = syllabus?.sections ?? [];

    async function refresh() {
        await qc.invalidateQueries({
            queryKey: ["syllabus", syllabusId],
        });

        await qc.invalidateQueries({
            queryKey: ["syllabuses"],
        });

        setValidation(null);
    }

    function openSection(
        section?: SyllabusSection
    ) {
        setEditingSection(section ?? null);

        setSectionTitle(
            section?.title ?? ""
        );

        const nextOrder = sections.length
            ? Math.max(
            ...sections.map(
                (s) => s.orderIndex
            )
        ) + 1
            : 1;

        setSectionOrder(
            String(
                section?.orderIndex ?? nextOrder
            )
        );

        setSectionOpen(true);
    }

    async function saveSection(
        e: FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();

        if (busy) return;

        const title = norm(sectionTitle);
        const order = Number(sectionOrder);

        if (
            title.length < 3 ||
            title.length > 150 ||
            !/\p{L}/u.test(title)
        ) {
            toast.error(
                "Section title must have 3-150 characters and contain letters"
            );
            return;
        }

        if (
            !/^(0|[1-9]\d*)$/.test(sectionOrder) ||
            !Number.isSafeInteger(order)
        ) {
            toast.error(
                "Order must be a non-negative integer"
            );
            return;
        }

        if (
            sections.some(
                (s) =>
                    s.id !== editingSection?.id &&
                    equal(s.title, title)
            )
        ) {
            toast.error(
                "Duplicate Section title"
            );
            return;
        }

        if (
            sections.some(
                (s) =>
                    s.id !== editingSection?.id &&
                    s.orderIndex === order
            )
        ) {
            toast.error(
                "Duplicate Section order"
            );
            return;
        }

        setBusy(true);

        try {
            if (editingSection) {
                await syllabusApi.editSection(
                    syllabusId,
                    editingSection.id,
                    title,
                    order
                );
            } else {
                await syllabusApi.addSection(
                    syllabusId,
                    title,
                    order
                );
            }

            setSectionOpen(false);

            await refresh();

            toast.success("Section saved");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    function openBulk() {
        setBulkCount(3);
        setBulkOpen(true);
    }

    function resizeBulk(value: number) {
        if (!Number.isFinite(value)) return;

        const count = Math.max(1, Math.min(30, Math.trunc(value)));
        setBulkCount(count);
    }

    async function saveBulk(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (busy) return;

        if (
            !Number.isInteger(bulkCount) ||
            bulkCount < 1 ||
            bulkCount > 30
        ) {
            toast.error("Number of sections must be between 1 and 30");
            return;
        }

        // Avoid duplicate internally generated section titles.
        const usedTitles = new Set(
            sections.map((s) => norm(s.title).toLowerCase())
        );

        const titles: string[] = [];

        let nextNumber =
            Math.max(0, ...sections.map((s) => s.orderIndex)) + 1;

        while (titles.length < bulkCount) {
            const title = `Section ${nextNumber++}`;
            const key = title.toLowerCase();

            if (!usedTitles.has(key)) {
                usedTitles.add(key);
                titles.push(title);
            }
        }

        setBusy(true);

        try {
            await syllabusApi.bulkSections(syllabusId, titles);

            await refresh();

            setBulkOpen(false);

            toast.success(`${titles.length} sections created successfully`);
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    function openTopic(
        section: SyllabusSection,
        topic?: Topic
    ) {
        setTopicSection(section);
        setEditingTopic(topic ?? null);
        setTopicTitle(topic?.title ?? "");
    }

    async function saveTopic(
        e: FormEvent<HTMLFormElement>
    ) {
        e.preventDefault();

        if (!topicSection || busy) return;

        const title = norm(topicTitle);

        if (
            title.length < 3 ||
            title.length > 200 ||
            !/\p{L}/u.test(title)
        ) {
            toast.error(
                "Topic title must contain letters and have 3-200 characters"
            );
            return;
        }

        if (
            topicSection.topics.some(
                (t) =>
                    t.id !== editingTopic?.id &&
                    equal(t.title, title)
            )
        ) {
            toast.error(
                "Duplicate Topic title"
            );
            return;
        }

        setBusy(true);

        try {
            if (editingTopic) {
                await syllabusApi.editTopic(
                    syllabusId,
                    topicSection.id,
                    editingTopic.id,
                    title
                );
            } else {
                await syllabusApi.addTopic(
                    syllabusId,
                    topicSection.id,
                    title
                );
            }

            setTopicSection(null);

            await refresh();

            toast.success("Topic saved");
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function remove() {
        if (!confirm || busy) return;

        setBusy(true);

        try {
            if (confirm.type === "section") {
                await syllabusApi.deleteSection(
                    syllabusId,
                    confirm.sectionId
                );
            } else if (
                confirm.topicId !== undefined
            ) {
                await syllabusApi.deleteTopic(
                    syllabusId,
                    confirm.sectionId,
                    confirm.topicId
                );
            }

            await refresh();

            setConfirm(null);

            toast.success(
                "Deleted successfully"
            );
        } catch (error) {
            toast.error(errorMessage(error));
        } finally {
            setBusy(false);
        }
    }

    async function validateSyllabus() {
        try {
            const result =
                await syllabusApi.validate(
                    syllabusId
                );

            setValidation(result);

            if (result.valid) {
                toast.success(
                    "Syllabus outline is ready"
                );
            } else {
                toast.error(
                    "Syllabus has missing content"
                );
            }
        } catch (error) {
            toast.error(errorMessage(error));
        }
    }

    return (
        <MainLayout
            pathName={{
                syllabuses: "Syllabuses",
                ...(id
                    ? { [id]: "Syllabus Details" }
                    : {}),
            }}
        >
            <div className="mx-auto w-full max-w-[1500px] space-y-6">
                <Button
                    asChild
                    variant="ghost"
                >
                    <Link to="/syllabuses">
                        <ArrowLeft className="size-4" />
                        Back to Syllabuses
                    </Link>
                </Button>

                {!validId ? (
                    <p>Invalid syllabus ID</p>
                ) : detailQuery.isLoading ? (
                    <p>Loading...</p>
                ) : detailQuery.isError ||
                !syllabus ? (
                    <div role="alert">
                        Could not load syllabus.

                        <Button
                            variant="outline"
                            onClick={() =>
                                void detailQuery.refetch()
                            }
                        >
                            Retry
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Syllabus Header */}
                        <section className="w-full rounded-xl border bg-card p-6">
                            <h1 className="break-words text-2xl font-bold">
                                {syllabus.name}
                            </h1>

                            <p className="mt-2 text-sm text-muted-foreground">
                                Code: {syllabus.code}
                            </p>
                        </section>

                        {/* General Information */}
                        <GeneralInformationPanel syllabusId={syllabusId} />

                        {/* Sections Toolbar */}
                        <div className="flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-xl font-semibold">
                                Sections & Topics
                            </h2>

                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        void validateSyllabus()
                                    }
                                >
                                    <CheckCircle2 className="size-4" />
                                    Validate
                                </Button>

                                {canAdd && (
                                    <>
                                        <Button
                                            variant="outline"
                                            onClick={() =>
                                                openSection()
                                            }
                                        >
                                            <Plus className="size-4" />
                                            Add Section
                                        </Button>

                                        <Button
                                            onClick={openBulk}
                                        >
                                            <Plus className="size-4" />
                                            Create Multiple Sections
                                        </Button>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Validation Result */}
                        {validation && (
                            <div
                                role="status"
                                className="rounded-lg border bg-card p-4 text-sm"
                            >
                                {validation.valid ? (
                                    "Valid outline: every section has a topic."
                                ) : (
                                    <>
                                        <strong>
                                            Validation issues:
                                        </strong>

                                        <ul className="list-inside list-disc">
                                            {validation.errors.map(
                                                (error, i) => (
                                                    <li key={i}>
                                                        {error}
                                                    </li>
                                                )
                                            )}
                                        </ul>
                                    </>
                                )}
                            </div>
                        )}

                        {sections.length === 0 && (
                            <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">
                                No sections yet. Create your first
                                Section or add many at once.
                            </p>
                        )}

                        {/* Section List */}
                        {sections.map(
                            (section, index) => (
                                <div
                                    key={section.id}
                                    className="space-y-3 rounded-xl border bg-card p-5"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <h3 className="font-semibold">
                                                Section {index + 1}

                                            </h3>

                                            <p className="text-xs text-muted-foreground">
                                                {section.topics.length} topics
                                            </p>
                                        </div>

                                        <div className="flex gap-2">
                                            {canEdit && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() =>
                                                        openSection(section)
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
                                                        setConfirm({
                                                            type: "section",
                                                            sectionId:
                                                            section.id,
                                                        })
                                                    }
                                                >
                                                    <Trash2 className="size-4" />
                                                    Delete
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Topics */}
                                    <div className="space-y-2 border-t pt-3">
                                        {section.topics.map(
                                            (topic) => (
                                                <div
                                                    key={topic.id}
                                                    className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2 text-sm"
                                                >
                          <span>
                            {topic.orderIndex}.{" "}
                              {topic.title}
                          </span>

                                                    <div className="flex gap-2">
                                                        {canEdit && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    openTopic(
                                                                        section,
                                                                        topic
                                                                    )
                                                                }
                                                            >
                                                                <Pencil className="size-4" />
                                                            </Button>
                                                        )}

                                                        {canDelete && (
                                                            <Button
                                                                size="sm"
                                                                variant="ghost"
                                                                onClick={() =>
                                                                    setConfirm({
                                                                        type: "topic",
                                                                        sectionId:
                                                                        section.id,
                                                                        topicId:
                                                                        topic.id,
                                                                    })
                                                                }
                                                            >
                                                                <Trash2 className="size-4" />
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            )
                                        )}

                                        {section.topics.length === 0 && (
                                            <p className="text-sm text-muted-foreground">
                                                No topics yet.
                                            </p>
                                        )}

                                        {canAdd && (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    openTopic(section)
                                                }
                                            >
                                                <Plus className="size-4" />
                                                Add Topic
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            )
                        )}
                    </>
                )}
            </div>

            {/* Create / Edit Section */}
            <Modal
                open={sectionOpen}
                onClose={() =>
                    !busy && setSectionOpen(false)
                }
                title={
                    editingSection
                        ? "Edit Section"
                        : "Add Section"
                }
            >
                <form
                    onSubmit={(e) =>
                        void saveSection(e)
                    }
                    className="space-y-4"
                >
                    <div>
                        <label
                            htmlFor="section-title"
                            className="mb-1 block text-sm"
                        >
                            Section Title
                        </label>

                        <Input
                            id="section-title"
                            value={sectionTitle}
                            maxLength={150}
                            onChange={(e) =>
                                setSectionTitle(
                                    e.target.value
                                )
                            }
                            required
                        />
                    </div>

                    <div>
                        <label
                            htmlFor="section-order"
                            className="mb-1 block text-sm"
                        >
                            Order Index
                        </label>

                        <Input
                            id="section-order"
                            type="number"
                            min={0}
                            step={1}
                            value={sectionOrder}
                            onChange={(e) =>
                                setSectionOrder(
                                    e.target.value
                                )
                            }
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setSectionOpen(false)
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            disabled={busy}
                            type="submit"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Bulk Create Sections */}
            <Modal
                open={bulkOpen}
                onClose={() => !busy && setBulkOpen(false)}
                title="Create Sections"
                size="lg"
            >
                <form
                    onSubmit={(e) => void saveBulk(e)}
                    className="space-y-4"
                >
                    <div>
                        <label
                            htmlFor="section-count"
                            className="mb-2 block text-sm font-medium"
                        >
                            Number of Sections
                        </label>

                        <Input
                            id="section-count"
                            type="number"
                            min={1}
                            max={30}
                            step={1}
                            value={bulkCount}
                            onChange={(e) => resizeBulk(Number(e.target.value))}
                            required
                        />

                        <p className="mt-2 text-sm text-muted-foreground">
                            Sections will be numbered automatically.
                            You can add topics after creating them.
                        </p>
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => setBulkOpen(false)}
                        >
                            Cancel
                        </Button>

                        <Button type="submit" disabled={busy}>
                            Create {bulkCount} Sections
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Create / Edit Topic */}
            <Modal
                open={topicSection !== null}
                onClose={() =>
                    !busy && setTopicSection(null)
                }
                title={
                    editingTopic
                        ? "Edit Topic"
                        : "Add Topic"
                }
            >
                <form
                    onSubmit={(e) =>
                        void saveTopic(e)
                    }
                    className="space-y-4"
                >
                    <div>
                        <label
                            htmlFor="topic-title"
                            className="mb-1 block text-sm"
                        >
                            Topic Title
                        </label>

                        <Input
                            id="topic-title"
                            maxLength={200}
                            value={topicTitle}
                            onChange={(e) =>
                                setTopicTitle(
                                    e.target.value
                                )
                            }
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setTopicSection(null)
                            }
                        >
                            Cancel
                        </Button>

                        <Button
                            disabled={busy}
                            type="submit"
                        >
                            Save
                        </Button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation */}
            <ConfirmDialog
                open={confirm !== null}
                title="Delete item?"
                description="Cannot delete a Section until its Topics are deleted."
                confirmLabel="Delete"
                onConfirm={() =>
                    void remove()
                }
                onCancel={() =>
                    !busy && setConfirm(null)
                }
                loading={busy}
            />
        </MainLayout>
    );
}