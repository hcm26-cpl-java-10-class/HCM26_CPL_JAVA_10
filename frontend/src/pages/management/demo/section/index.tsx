
import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { courseApi } from "@/api/features/demo/course.api";
import { sectionApi } from "@/api/features/demo/section.api";
import type { SectionDTO } from "@/types/features/demo/section";

import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { ConfirmDialog } from "@/components/ui/confirmdialog";

export default function SectionManagementPage() {
    const [courseId, setCourseId] = useState(0);
    const [formOpen, setFormOpen] = useState(false);
    const [editing, setEditing] = useState<SectionDTO | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<SectionDTO | null>(null);

    const [title, setTitle] = useState("");
    const [orderIndex, setOrderIndex] = useState(1);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Lấy danh sách khóa học
    const coursesQuery = useQuery({
        queryKey: ["section-courses"],
        queryFn: () => courseApi.getPage({ page: 0, size: 100 })
    });

    // Lấy Section theo khóa học
    const sectionsQuery = useQuery({
        queryKey: ["sections", courseId],
        queryFn: () => sectionApi.getByCourse(courseId),
        enabled: courseId > 0
    });

    const courses =
        coursesQuery.data?.content ?? coursesQuery.data?.items ?? [];

    const sections =
        sectionsQuery.data?.content ?? sectionsQuery.data?.items ?? [];

    // Mở form thêm
    function openCreate() {
        setEditing(null);
        setTitle("");
        setOrderIndex(sections.length + 1);
        setFormOpen(true);
    }

    // Mở form sửa
    function openEdit(section: SectionDTO) {
        setEditing(section);
        setTitle(section.title);
        setOrderIndex(section.orderIndex);
        setFormOpen(true);
    }

    // Lưu Section
    async function handleSave(e: FormEvent<HTMLFormElement>) {
        e.preventDefault();

        if (!courseId) {
            toast.error("Please select a course");
            return;
        }

        if (!title.trim()) {
            toast.error("Section title is required");
            return;
        }

        if (!Number.isInteger(orderIndex) || orderIndex < 0) {
            toast.error("Invalid order index");
            return;
        }

        const data = {
            courseId,
            title: title.trim(),
            orderIndex,
            isActive: editing?.isActive ?? true
        };

        setSaving(true);

        try {
            if (editing?.id != null) {
                await sectionApi.update(editing.id, data);
                toast.success("Section updated successfully");
            } else {
                await sectionApi.create(data);
                toast.success("Section created successfully");
            }

            setFormOpen(false);
            await sectionsQuery.refetch();
        } catch {
            toast.error("Failed to save section");
        } finally {
            setSaving(false);
        }
    }

    // Xóa Section
    async function handleDelete() {
        if (deleteTarget?.id == null) return;

        setDeleting(true);

        try {
            await sectionApi.delete(deleteTarget.id);
            toast.success("Section deleted successfully");
            setDeleteTarget(null);
            await sectionsQuery.refetch();
        } catch {
            toast.error("Failed to delete section");
        } finally {
            setDeleting(false);
        }
    }

    return (
        <MainLayout pathName={{ "course-sections": "Course Sections" }}>
            <div className="space-y-6">

                {/* Tiêu đề */}
                <div className="flex items-center justify-between">
                    <h1 className="text-2xl font-bold">
                        Course Sections
                    </h1>

                    <Button disabled={!courseId} onClick={openCreate}>
                        + Add Section
                    </Button>
                </div>

                {/* Chọn khóa học */}
                <div className="rounded-lg border bg-card p-4">
                    <label className="mb-2 block text-sm font-medium">
                        Select Course
                    </label>

                    <select
                        className="w-full rounded-md border bg-background p-2"
                        value={courseId}
                        onChange={(e) => setCourseId(Number(e.target.value))}
                    >
                        <option value={0}>Choose a course</option>

                        {courses.map((course) => (
                            <option key={course.id} value={course.id}>
                                {course.name}
                            </option>
                        ))}
                    </select>

                    {coursesQuery.isLoading && (
                        <p className="mt-2 text-sm">Loading courses...</p>
                    )}

                    {coursesQuery.isError && (
                        <p className="mt-2 text-sm text-destructive">
                            Failed to load courses
                        </p>
                    )}
                </div>

                {/* Danh sách chương */}
                <div className="space-y-3">
                    {!courseId ? (
                        <p className="text-muted-foreground">
                            Please select a course.
                        </p>
                    ) : sectionsQuery.isLoading ? (
                        <p>Loading sections...</p>
                    ) : sectionsQuery.isError ? (
                        <p className="text-destructive">
                            Failed to load sections.
                        </p>
                    ) : sections.length === 0 ? (
                        <p className="text-muted-foreground">
                            No sections found.
                        </p>
                    ) : (
                        sections.map((section) => (
                            <div
                                key={section.id}
                                className="flex items-center justify-between rounded-lg border bg-card p-4"
                            >
                                <div>
                                    <h3 className="font-medium">
                                        {section.title}
                                    </h3>
                                    <p className="text-sm text-muted-foreground">
                                        Order: {section.orderIndex}
                                    </p>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => openEdit(section)}
                                    >
                                        Edit
                                    </Button>

                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={() => setDeleteTarget(section)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Modal thêm / sửa */}
                <Modal
                    open={formOpen}
                    onClose={() => {
                        if (!saving) setFormOpen(false);
                    }}
                    title={editing ? "Edit Section" : "Add Section"}
                    size="sm"
                >
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="mb-1 block text-sm">
                                Section Title
                            </label>

                            <Input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="Enter section title"
                            />
                        </div>

                        <div>
                            <label className="mb-1 block text-sm">
                                Order Index
                            </label>

                            <Input
                                type="number"
                                min={0}
                                value={orderIndex}
                                onChange={(e) =>
                                    setOrderIndex(Number(e.target.value))
                                }
                            />
                        </div>

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

                {/* Xác nhận xóa */}
                <ConfirmDialog
                    open={deleteTarget !== null}
                    title="Delete Section"
                    description="Are you sure you want to delete this section?"
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
