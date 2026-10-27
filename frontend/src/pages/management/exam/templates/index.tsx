import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookmarkPlus, Trash2, Clock, FileText } from "lucide-react";

import { examTemplateApi } from "@/api";
import type { ExamTemplateDTO } from "@/api/features/exam-template.api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

export default function ExamTemplatesPage() {
    const queryClient = useQueryClient();

    const [selectedTemplate, setSelectedTemplate] =
        useState<ExamTemplateDTO | null>(null);

    const [examTitle, setExamTitle] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    // 1. Lấy danh sách template
    const {
        data: templates = [],
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ["exam-templates"],
        queryFn: () => examTemplateApi.list(),
    });

    // 2. Tạo đề thi mới từ template đã chọn
    const createExamMutation = useMutation({
        mutationFn: () => {
            if (!selectedTemplate) {
                throw new Error("Please select a template");
            }

            if (!examTitle.trim()) {
                throw new Error("Exam title is required");
            }

            return examTemplateApi.createExam(selectedTemplate.id, {
                title: examTitle.trim(),
                startTime: startTime || undefined,
                endTime: endTime || undefined,
            });
        },

        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["exams"] });

            toast.success("New exam created from template successfully");

            setSelectedTemplate(null);
            setExamTitle("");
            setStartTime("");
            setEndTime("");
        },

        onError: (error) => {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to create exam from template";

            toast.error(message);
        },
    });

    // 3. Xóa template
    const deleteTemplateMutation = useMutation({
        mutationFn: (templateId: number) =>
            examTemplateApi.delete(templateId),

        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: ["exam-templates"],
            });

            toast.success("Template deleted successfully");
        },

        onError: () => {
            toast.error("Failed to delete template");
        },
    });

    // Mở dialog tạo đề mới
    const openCreateDialog = (template: ExamTemplateDTO) => {
        setSelectedTemplate(template);
        setExamTitle(template.name.replace(/\s*-\s*Template\s*$/i, ""));
        setStartTime("");
        setEndTime("");
    };

    const closeCreateDialog = () => {
        if (createExamMutation.isPending) return;

        setSelectedTemplate(null);
        setExamTitle("");
        setStartTime("");
        setEndTime("");
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">Exam Templates</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Manage saved templates and create new exams from them.
                </p>
            </div>

            {/* Danh sách template */}
            {isLoading ? (
                <p className="text-sm text-muted-foreground">
                    Loading templates...
                </p>
            ) : isError ? (
                <div className="space-y-3">
                    <p className="text-sm text-destructive">
                        Failed to load templates.
                    </p>
                    <Button variant="outline" onClick={() => refetch()}>
                        Try again
                    </Button>
                </div>
            ) : templates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center">
                    <BookmarkPlus className="mx-auto mb-3 size-10 text-muted-foreground" />
                    <h2 className="font-semibold">No templates yet</h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        Save an existing exam as a template before using it here.
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {templates.map((template) => (
                        <div
                            key={template.id}
                            className="flex flex-col justify-between rounded-lg border p-5"
                        >
                            <div className="space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="rounded-md bg-muted p-2">
                                        <FileText className="size-5" />
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <h2 className="break-words font-semibold">
                                            {template.name}
                                        </h2>
                                        {template.description && (
                                            <p className="mt-1 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                                                {template.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="size-4" />
                      {template.questionCount} questions
                  </span>

                                    <span className="flex items-center gap-1">
                    <Clock className="size-4" />
                                        {template.durationMinutes} minutes
                  </span>
                                </div>

                                {template.maxAttempts != null && (
                                    <p className="text-sm text-muted-foreground">
                                        Maximum attempts: {template.maxAttempts}
                                    </p>
                                )}
                            </div>

                            <div className="mt-5 flex gap-2">
                                <Button
                                    className="flex-1"
                                    onClick={() => openCreateDialog(template)}
                                >
                                    <BookmarkPlus className="mr-2 size-4" />
                                    Use Template
                                </Button>

                                <Button
                                    variant="outline"
                                    size="icon"
                                    aria-label={`Delete ${template.name}`}
                                    title="Delete template"
                                    disabled={deleteTemplateMutation.isPending}
                                    onClick={() => {
                                        const confirmed = window.confirm(
                                            `Delete template "${template.name}"?`
                                        );

                                        if (confirmed) {
                                            deleteTemplateMutation.mutate(template.id);
                                        }
                                    }}
                                >
                                    <Trash2 className="size-4" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Dialog tạo đề thi mới */}
            <Dialog
                open={selectedTemplate !== null}
                onOpenChange={(open) => {
                    if (!open) closeCreateDialog();
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create Exam from Template</DialogTitle>
                        <DialogDescription>
                            The template's configuration and questions will be copied
                            into a new exam. Your saved template will remain unchanged.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedTemplate && (
                        <div className="space-y-4">
                            <div className="rounded-md bg-muted p-3 text-sm">
                                <p className="font-medium">{selectedTemplate.name}</p>
                                <p className="mt-1 text-muted-foreground">
                                    {selectedTemplate.questionCount} questions ·{" "}
                                    {selectedTemplate.durationMinutes} minutes
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="new-exam-title" className="text-sm font-medium">
                                    New exam title
                                </label>
                                <Input
                                    id="new-exam-title"
                                    value={examTitle}
                                    onChange={(event) => setExamTitle(event.target.value)}
                                    placeholder="Enter exam title"
                                    maxLength={200}
                                    required
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="new-exam-start" className="text-sm font-medium">
                                    Start time (optional)
                                </label>
                                <Input
                                    id="new-exam-start"
                                    type="datetime-local"
                                    value={startTime}
                                    onChange={(event) => setStartTime(event.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <label htmlFor="new-exam-end" className="text-sm font-medium">
                                    End time (optional)
                                </label>
                                <Input
                                    id="new-exam-end"
                                    type="datetime-local"
                                    value={endTime}
                                    onChange={(event) => setEndTime(event.target.value)}
                                />
                            </div>

                            {startTime && endTime && endTime <= startTime && (
                                <p className="text-sm text-destructive">
                                    End time must be later than start time.
                                </p>
                            )}
                        </div>
                    )}

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={closeCreateDialog}
                            disabled={createExamMutation.isPending}
                        >
                            Cancel
                        </Button>

                        <Button
                            type="button"
                            disabled={
                                !examTitle.trim() ||
                                createExamMutation.isPending ||
                                (!!startTime && !!endTime && endTime <= startTime)
                            }
                            onClick={() => createExamMutation.mutate()}
                        >
                            {createExamMutation.isPending
                                ? "Creating..."
                                : "Create Exam"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}