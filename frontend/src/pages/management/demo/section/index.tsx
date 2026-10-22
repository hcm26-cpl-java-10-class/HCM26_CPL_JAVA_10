import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
    ArrowLeft,
    BookOpen,
    ChevronDown,
    ChevronUp,
    Plus,
} from "lucide-react";

import { courseApi } from "@/api/features/demo/course.api";
import { sectionApi } from "@/api/features/demo/section.api";
import type { SectionDTO } from "@/types/features/demo/section";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";
import { SectionLessons } from "@/pages/management/demo/lesson/components/SectionLessons";
import { usePermissions } from "@/hooks/usePermissions";

// ======================================
// VALIDATION HELPERS
// ======================================

type FormErrors = {
    title?: string;
    orderIndex?: string;
};

const SECTION_TEMPLATES = [
    "Course Introduction",
    "Foundations",
    "Core Concepts",
    "Guided Practice",
    "Assessment and Review",
    "Final Project",
];

function normalizeTitle(value: string): string {
    return value.trim().replace(/\s+/g, " ");
}

function titleKey(value: string): string {
    return normalizeTitle(value).toLocaleLowerCase("vi");
}

function apiError(error: unknown): {
    message: string;
    fields: FormErrors;
} {
    if (axios.isAxiosError(error)) {
        const payload: unknown = error.response?.data;

        if (payload && typeof payload === "object") {
            const data = payload as {
                message?: unknown;
                errors?: unknown;
            };

            if (data.errors && typeof data.errors === "object") {
                const fields: FormErrors = {};
                const messages: string[] = [];

                for (const [field, value] of Object.entries(data.errors)) {
                    const items = Array.isArray(value) ? value : [value];

                    const strings = items.filter(
                        (item): item is string => typeof item === "string"
                    );

                    messages.push(...strings);

                    if (field === "title") {
                        fields.title = strings[0];
                    }

                    if (field === "orderIndex") {
                        fields.orderIndex = strings[0];
                    }
                }

                if (messages.length > 0) {
                    return {
                        message: messages.join("; "),
                        fields,
                    };
                }
            }

            if (
                typeof data.message === "string" &&
                data.message !== "Validation failed"
            ) {
                return {
                    message: data.message,
                    fields: {},
                };
            }
        }

        const status = error.response?.status;

        if (status === 401) {
            return {
                message: "Please log in again.",
                fields: {},
            };
        }

        if (status === 403) {
            return {
                message: "You do not have permission.",
                fields: {},
            };
        }

        if (status === 404) {
            return {
                message: "Course or Section not found.",
                fields: {},
            };
        }

        if (!error.response) {
            return {
                message: "Cannot connect to Backend.",
                fields: {},
            };
        }
    }

    return {
        message: "Operation failed. Please try again.",
        fields: {},
    };
}

// ======================================
// MAIN COMPONENT
// ======================================

export default function SectionManagementPage() {
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();

    // Course ID từ URL
    const parsedCourseId = Number(searchParams.get("courseId"));

    const courseId =
        Number.isSafeInteger(parsedCourseId) && parsedCourseId > 0
            ? parsedCourseId
            : 0;

    // Quyền người dùng
    const { hasPermission } = usePermissions();

    const canCreate = hasPermission("SECTION_CREATE");
    const canUpdate = hasPermission("SECTION_UPDATE");
    const canDelete = hasPermission("SECTION_DELETE");

    // State
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<SectionDTO | null>(null);

    const [deleteTarget, setDeleteTarget] =
        useState<SectionDTO | null>(null);

    const [title, setTitle] = useState("");
    const [orderIndexInput, setOrderIndexInput] = useState("1");

    const [formErrors, setFormErrors] = useState<FormErrors>({});

    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const [expandedSectionId, setExpandedSectionId] =
        useState<number | null>(null);

    // ======================================
    // GET COURSES
    // ======================================

    const coursesQuery = useQuery({
        queryKey: ["section-courses"],
        queryFn: () =>
            courseApi.getPage({
                page: 0,
                size: 100,
            }),
    });

    // ======================================
    // GET SECTIONS
    // ======================================

    const sectionsQuery = useQuery({
        queryKey: ["sections", courseId],
        queryFn: () => sectionApi.getByCourse(courseId),
        enabled: courseId > 0,
    });

    const courses =
        coursesQuery.data?.content ??
        coursesQuery.data?.items ??
        [];

    const sections = [
        ...(sectionsQuery.data?.content ??
            sectionsQuery.data?.items ??
            []),
    ].sort(
        (a, b) =>
            a.orderIndex - b.orderIndex ||
            (a.id ?? 0) - (b.id ?? 0)
    );

    const selectedCourse = courses.find(
        (course) => course.id === courseId
    );

    // ======================================
    // VALIDATE TITLE
    // ======================================

    function validateTitle(
        rawTitle: string,
        currentId?: number | null
    ): string | undefined {
        const clean = normalizeTitle(rawTitle);

        if (!clean) {
            return "Section title is required.";
        }

        if (clean.length < 3) {
            return "Title must contain at least 3 characters.";
        }

        if (clean.length > 150) {
            return "Title must not exceed 150 characters.";
        }

        // Phải chứa ít nhất một chữ cái
        if (!/\p{L}/u.test(clean)) {
            return "Title must contain letters, not only numbers or symbols.";
        }

        // Kiểm tra trùng tên trong cùng Course
        const duplicate = sections.some(
            (section) =>
                section.id !== currentId &&
                titleKey(section.title) === titleKey(clean)
        );

        if (duplicate) {
            return "Another section in this course already has this title.";
        }

        return undefined;
    }

    // ======================================
    // VALIDATE ORDER INDEX
    // ======================================

    function validateOrder(
        rawOrder: string,
        current?: SectionDTO | null
    ): string | undefined {
        const raw = rawOrder.trim();

        if (!raw) {
            return "Order index is required.";
        }

        if (!/^(0|[1-9]\d*)$/.test(raw)) {
            return "Order index must be a non-negative integer.";
        }

        const next = Number(raw);

        if (!Number.isSafeInteger(next)) {
            return "Order index is too large.";
        }

        // Cho phép giữ nguyên thứ tự cũ khi Edit
        if (current && next === current.orderIndex) {
            return undefined;
        }

        // Kiểm tra trùng thứ tự
        const duplicate = sections.some(
            (section) =>
                section.id !== current?.id &&
                section.orderIndex === next
        );

        if (duplicate) {
            return `Order ${next} is already used by another section.`;
        }

        return undefined;
    }

    // ======================================
    // CHANGE COURSE
    // ======================================

    function handleCourseChange(nextCourseId: number) {
        const params = new URLSearchParams(searchParams);

        if (nextCourseId > 0) {
            params.set("courseId", String(nextCourseId));
        } else {
            params.delete("courseId");
        }

        setSearchParams(params);
        setExpandedSectionId(null);
        setFormOpen(false);
        setEditing(null);
        setFormErrors({});
    }

    // ======================================
    // ADD SECTION
    // ======================================

    function openCreate() {
        if (!courseId || !canCreate) return;

        setEditing(null);
        setTitle("");

        const nextOrder = sections.length
            ? Math.max(...sections.map((s) => s.orderIndex)) + 1
            : 1;

        setOrderIndexInput(String(nextOrder));
        setFormErrors({});
        setFormOpen(true);
    }

    // ======================================
    // EDIT SECTION
    // ======================================

    function openEdit(section: SectionDTO) {
        if (!canUpdate) return;

        setEditing(section);
        setTitle(section.title);
        setOrderIndexInput(String(section.orderIndex));
        setFormErrors({});
        setFormOpen(true);
    }

    // ======================================
    // SAVE SECTION
    // ======================================

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (saving) return;

        if (!courseId) {
            toast.error("Please select a course.");
            return;
        }

        if (editing && !canUpdate) return;
        if (!editing && !canCreate) return;

        // Kiểm tra dữ liệu
        const errors: FormErrors = {
            title: validateTitle(title, editing?.id),
            orderIndex: validateOrder(orderIndexInput, editing),
        };

        setFormErrors(errors);

        if (errors.title || errors.orderIndex) {
            toast.error(
                errors.title ??
                errors.orderIndex ??
                "Please check the form."
            );
            return;
        }

        const data = {
            courseId,
            title: normalizeTitle(title),
            orderIndex: Number(orderIndexInput.trim()),
            isActive: editing?.isActive ?? true,
        };

        setSaving(true);

        try {
            if (editing?.id != null) {
                await sectionApi.update(editing.id, data);
                toast.success("Section updated successfully.");
            } else {
                await sectionApi.create(data);
                toast.success("Section created successfully.");
            }

            setFormOpen(false);
            setEditing(null);
            setFormErrors({});

            await sectionsQuery.refetch();

            await queryClient.invalidateQueries({
                queryKey: ["course-detail", courseId],
            });
        } catch (error) {
            const parsed = apiError(error);

            setFormErrors(parsed.fields);
            toast.error(parsed.message);
        } finally {
            setSaving(false);
        }
    }

    // ======================================
    // DELETE SECTION
    // ======================================

    async function handleDelete() {
        if (
            !deleteTarget ||
            deleteTarget.id == null ||
            !canDelete ||
            deleting
        ) {
            return;
        }

        setDeleting(true);

        try {
            await sectionApi.delete(deleteTarget.id);

            if (expandedSectionId === deleteTarget.id) {
                setExpandedSectionId(null);
            }

            setDeleteTarget(null);
            toast.success("Section deleted successfully.");

            await sectionsQuery.refetch();

            await queryClient.invalidateQueries({
                queryKey: ["course-detail", courseId],
            });
        } catch (error) {
            toast.error(apiError(error).message);
        } finally {
            setDeleting(false);
        }
    }

    // ======================================
    // LEGACY DATA VALIDATION
    // ======================================

    const invalidExistingSections = sections.filter((section) => {
        const hasDuplicateTitle = sections.some(
            (other) =>
                other.id !== section.id &&
                titleKey(other.title) === titleKey(section.title)
        );

        const hasDuplicateOrder = sections.some(
            (other) =>
                other.id !== section.id &&
                other.orderIndex === section.orderIndex
        );

        const invalidTitle =
            normalizeTitle(section.title).length < 3 ||
            !/\p{L}/u.test(section.title);

        return hasDuplicateTitle || hasDuplicateOrder || invalidTitle;
    });

    // ======================================
    // UI
    // ======================================

    return (
        <MainLayout
            pathName={{
                "course-sections": "Curriculum Builder",
            }}
        >
            <div className="mx-auto w-full max-w-6xl space-y-6">
                {/* Back */}
                <Button asChild variant="ghost" size="sm">
                    <Link
                        to={courseId ? `/courses/${courseId}` : "/courses"}
                    >
                        <ArrowLeft className="size-4" />
                        Back to Course
                    </Link>
                </Button>

                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold">
                            Curriculum Builder
                        </h1>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Manage sections and lessons of your course.
                        </p>

                        {selectedCourse && (
                            <p className="mt-2 text-sm font-medium">
                                Course: {selectedCourse.name}
                            </p>
                        )}
                    </div>

                    {canCreate && (
                        <Button
                            onClick={openCreate}
                            disabled={
                                !courseId ||
                                saving ||
                                sectionsQuery.isLoading ||
                                sectionsQuery.isError
                            }
                        >
                            <Plus className="size-4" />
                            Add Section
                        </Button>
                    )}
                </div>

                {/* Select Course */}
                <div className="rounded-xl border bg-card p-5">
                    <label
                        htmlFor="course-select"
                        className="mb-2 block text-sm font-medium"
                    >
                        Select Course
                    </label>

                    <select
                        id="course-select"
                        className="w-full rounded-md border bg-background p-2"
                        value={courseId}
                        onChange={(event) =>
                            handleCourseChange(Number(event.target.value))
                        }
                    >
                        <option value={0}>Choose a course</option>

                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.name}
                            </option>
                        ))}
                    </select>

                    {coursesQuery.isLoading && (
                        <p className="mt-2 text-sm">
                            Loading courses...
                        </p>
                    )}

                    {coursesQuery.isError && (
                        <p
                            role="alert"
                            className="mt-2 text-sm text-destructive"
                        >
                            Failed to load courses.
                        </p>
                    )}
                </div>

                {/* Sections */}
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <BookOpen className="size-5" />

                        <h2 className="text-lg font-semibold">
                            Sections &amp; Lessons
                        </h2>

                        {!!courseId && (
                            <span className="text-sm text-muted-foreground">
                ({sections.length} sections)
              </span>
                        )}
                    </div>

                    {/* Cảnh báo dữ liệu cũ */}
                    {!!courseId &&
                        !sectionsQuery.isLoading &&
                        !sectionsQuery.isError &&
                        invalidExistingSections.length > 0 && (
                            <div
                                role="alert"
                                className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm"
                            >
                                {invalidExistingSections.length} existing
                                section(s) have invalid or duplicate title/order
                                values. Edit them to correct the data.
                            </div>
                        )}

                    {!courseId ? (
                        <div className="rounded-xl border p-8 text-center text-muted-foreground">
                            Please select a course.
                        </div>
                    ) : sectionsQuery.isLoading ? (
                        <div className="rounded-xl border p-8 text-center">
                            Loading sections...
                        </div>
                    ) : sectionsQuery.isError ? (
                        <div
                            role="alert"
                            className="rounded-xl border p-8 text-center"
                        >
                            <p className="mb-3 text-destructive">
                                Failed to load sections.
                            </p>

                            <Button
                                variant="outline"
                                onClick={() => void sectionsQuery.refetch()}
                            >
                                Try Again
                            </Button>
                        </div>
                    ) : sections.length === 0 ? (
                        <div className="rounded-xl border border-dashed p-10 text-center">
                            <BookOpen className="mx-auto mb-3 size-8 text-muted-foreground" />

                            <h3 className="font-semibold">
                                No sections yet
                            </h3>

                            <p className="mt-1 text-sm text-muted-foreground">
                                Add the first section to start building
                                your curriculum.
                            </p>

                            {canCreate && (
                                <Button className="mt-4" onClick={openCreate}>
                                    <Plus className="size-4" />
                                    Add Section
                                </Button>
                            )}
                        </div>
                    ) : (
                        sections.map((section) => {
                            const sameTitle = sections.some(
                                (other) =>
                                    other.id !== section.id &&
                                    titleKey(other.title) ===
                                    titleKey(section.title)
                            );

                            const sameOrder = sections.some(
                                (other) =>
                                    other.id !== section.id &&
                                    other.orderIndex === section.orderIndex
                            );

                            const invalidTitle =
                                normalizeTitle(section.title).length < 3 ||
                                !/\p{L}/u.test(section.title);

                            return (
                                <div
                                    key={section.id}
                                    className="space-y-4 rounded-xl border bg-card p-5"
                                >
                                    {/* Section Header */}
                                    <div className="flex flex-wrap items-center justify-between gap-3">
                                        <div>
                                            <h3 className="text-base font-semibold">
                                                {section.title}
                                            </h3>

                                            <p className="mt-1 text-sm text-muted-foreground">
                                                Order: {section.orderIndex}
                                            </p>

                                            {(sameTitle ||
                                                sameOrder ||
                                                invalidTitle) && (
                                                <p
                                                    role="alert"
                                                    className="mt-1 text-xs text-amber-500"
                                                >
                                                    {[
                                                        sameTitle && "Duplicate title",
                                                        sameOrder && "Duplicate order",
                                                        invalidTitle && "Invalid title",
                                                    ]
                                                        .filter(Boolean)
                                                        .join(" · ")}
                                                    . Please edit this section.
                                                </p>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() =>
                                                    setExpandedSectionId((current) =>
                                                        current === section.id
                                                            ? null
                                                            : section.id ?? null
                                                    )
                                                }
                                            >
                                                {expandedSectionId === section.id ? (
                                                    <ChevronUp className="size-4" />
                                                ) : (
                                                    <ChevronDown className="size-4" />
                                                )}

                                                {expandedSectionId === section.id
                                                    ? "Hide Lessons"
                                                    : "View Lessons"}
                                            </Button>

                                            {canUpdate && (
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => openEdit(section)}
                                                >
                                                    Edit
                                                </Button>
                                            )}

                                            {canDelete && (
                                                <Button
                                                    variant="destructive"
                                                    size="sm"
                                                    onClick={() => setDeleteTarget(section)}
                                                >
                                                    Delete
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Lesson CRUD của nhóm */}
                                    {section.id != null &&
                                        expandedSectionId === section.id && (
                                            <div className="border-t pt-4">
                                                <SectionLessons sectionId={section.id} />
                                            </div>
                                        )}
                                </div>
                            );
                        })
                    )}
                </div>

<<<<<<< Updated upstream:frontend/src/pages/management/demo/section/index.tsx
=======
                {/* CREATE MULTIPLE SECTIONS MODAL */}
                <Modal
                    open={bulkOpen}
                    onClose={() => {
                        if (!bulkSaving) {
                            setBulkOpen(false);
                        }
                    }}
                    title="Create Multiple Sections"
                    size="lg"
                >
                    <form
                        onSubmit={(event) => void handleBulkSave(event)}
                        className="space-y-4"
                        noValidate
                    >
                        <div>
                            <label
                                htmlFor="bulk-section-count"
                                className="mb-2 block text-sm font-medium"
                            >
                                Number of Sections (1-30)
                            </label>

                            <Input
                                id="bulk-section-count"
                                type="number"
                                min={1}
                                max={30}
                                step={1}
                                value={bulkCountInput}
                                disabled={bulkSaving}
                                onChange={(event) =>
                                    changeBulkCount(event.target.value)
                                }
                            />
                        </div>

                        <div className="max-h-[45vh] space-y-3 overflow-y-auto pr-2">
                            {bulkTitles.map((sectionTitle, index) => (
                                <div key={index} className="space-y-1">
                                    <label
                                        htmlFor={`bulk-title-${index}`}
                                        className="text-sm font-medium"
                                    >
                                        Section {index + 1} Title
                                    </label>

                                    <Input
                                        id={`bulk-title-${index}`}
                                        value={sectionTitle}
                                        maxLength={150}
                                        disabled={bulkSaving}
                                        placeholder={`Enter Section ${index + 1} title`}
                                        aria-invalid={!!bulkErrors[index]}
                                        onChange={(event) =>
                                            changeBulkTitle(
                                                index,
                                                event.target.value
                                            )
                                        }
                                    />

                                    {bulkErrors[index] && (
                                        <p
                                            role="alert"
                                            className="text-sm text-destructive"
                                        >
                                            {bulkErrors[index]}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground">
                            Each title: required · 3–150 characters · must contain letters · no duplicates.
                            Sections will be added after the last section in the selected course.
                        </p>

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={bulkSaving}
                                onClick={() => setBulkOpen(false)}
                            >
                                Cancel
                            </Button>

                            <Button
                                type="submit"
                                disabled={
                                    bulkSaving ||
                                    !courseId ||
                                    sectionsQuery.isLoading ||
                                    sectionsQuery.isError
                                }
                            >
                                {bulkSaving
                                    ? "Creating..."
                                    : `Create ${bulkCountInput || "0"} Sections`}
                            </Button>
                        </div>
                    </form>
                </Modal>




>>>>>>> Stashed changes:frontend/src/pages/management/demo/curriculum/index.tsx
                {/* ADD / EDIT MODAL */}
                <Modal
                    open={formOpen}
                    onClose={() => {
                        if (!saving) setFormOpen(false);
                    }}
                    title={editing ? "Edit Section" : "Add Section"}
                    size="sm"
                >
                    <form
                        onSubmit={(event) => void handleSave(event)}
                        className="space-y-4"
                        noValidate
                    >
                        {!editing && (
                            <div>
                                <label
                                    htmlFor="section-template"
                                    className="mb-1 block text-sm font-medium"
                                >
                                    Section Template
                                </label>
                                <select
                                    id="section-template"
                                    className="w-full rounded-md border bg-background p-2"
                                    defaultValue=""
                                    onChange={(event) => {
                                        setTitle(event.target.value);
                                        setFormErrors((prev) => ({ ...prev, title: undefined }));
                                    }}
                                >
                                    <option value="" disabled>Choose a template</option>
                                    {SECTION_TEMPLATES.map((template) => (
                                        <option key={template} value={template}>{template}</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Choose a common section or enter your own title below.
                                </p>
                            </div>
                        )}

                        {/* TITLE */}
                        <div>
                            <label
                                htmlFor="section-title"
                                className="mb-1 block text-sm font-medium"
                            >
                                Section Title
                            </label>

                            <Input
                                id="section-title"
                                value={title}
                                maxLength={150}
                                onChange={(event) => {
                                    setTitle(event.target.value);

                                    if (formErrors.title) {
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            title: undefined,
                                        }));
                                    }
                                }}
                                onBlur={() =>
                                    setFormErrors((prev) => ({
                                        ...prev,
                                        title: validateTitle(title, editing?.id),
                                    }))
                                }
                                placeholder="Example: Java Introduction"
                                aria-invalid={!!formErrors.title}
                                required
                            />

                            {formErrors.title && (
                                <p
                                    role="alert"
                                    className="mt-1 text-sm text-destructive"
                                >
                                    {formErrors.title}
                                </p>
                            )}

                            <p className="mt-1 text-xs text-muted-foreground">
                                Required · 3–150 characters · must contain letters · unique in this course ({title.length}/150)
                            </p>
                        </div>

                        {/* ORDER */}
                        <div>
                            <label
                                htmlFor="section-order"
                                className="mb-1 block text-sm font-medium"
                            >
                                Order Index
                            </label>

                            <Input
                                id="section-order"
                                type="number"
                                min={0}
                                step={1}
                                value={orderIndexInput}
                                onChange={(event) => {
                                    setOrderIndexInput(event.target.value);

                                    if (formErrors.orderIndex) {
                                        setFormErrors((prev) => ({
                                            ...prev,
                                            orderIndex: undefined,
                                        }));
                                    }
                                }}
                                onBlur={() =>
                                    setFormErrors((prev) => ({
                                        ...prev,
                                        orderIndex: validateOrder(
                                            orderIndexInput,
                                            editing
                                        ),
                                    }))
                                }
                                aria-invalid={!!formErrors.orderIndex}
                                required
                            />

                            {formErrors.orderIndex && (
                                <p
                                    role="alert"
                                    className="mt-1 text-sm text-destructive"
                                >
                                    {formErrors.orderIndex}
                                </p>
                            )}

                            <p className="mt-1 text-xs text-muted-foreground">
                                Required · whole number ≥ 0 · unique within this course.
                            </p>
                        </div>

                        {/* BUTTONS */}
                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={saving}
                                onClick={() => setFormOpen(false)}
                            >
                                Cancel
                            </Button>

                            <Button type="submit" disabled={saving}>
                                {saving ? "Saving..." : "Save"}
                            </Button>
                        </div>
                    </form>
                </Modal>

                {/* DELETE CONFIRM */}
                <ConfirmDialog
                    open={deleteTarget !== null}
                    title="Delete Section"
                    description={`Delete "${
                        deleteTarget?.title ?? ""
                    }"? Sections containing lessons cannot be deleted until their lessons are removed.`}
                    confirmLabel="Delete"
                    onConfirm={() => void handleDelete()}
                    onCancel={() => {
                        if (!deleting) setDeleteTarget(null);
                    }}
                    loading={deleting}
                />
            </div>
        </MainLayout>
    );
}