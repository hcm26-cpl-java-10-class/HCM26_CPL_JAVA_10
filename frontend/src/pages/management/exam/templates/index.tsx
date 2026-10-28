import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    ArrowLeft,
    BookmarkPlus,
    Clock,
    Coffee,
    Code2,
    Eye,
    HelpCircle,
    Layers,
    MoreVertical,
    Search,
    ShieldCheck,
    Trash2,
} from "lucide-react";

import { examTemplateApi } from "@/api";
import type { ExamTemplateDTO } from "@/api/features/exam-template.api";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";

function getTemplateCategory(name: string) {
    const lower = name.toLowerCase();

    if (lower.includes("java")) {
        return {
            tag: "JAVA",
            colorClass: "bg-amber-950/40 text-amber-400 border-amber-800/40",
            icon: Coffee,
            iconBg: "bg-amber-950/50 text-amber-400 border border-amber-800/30",
        };
    }

    if (lower.includes("python")) {
        return {
            tag: "PYTHON",
            colorClass: "bg-cyan-950/40 text-cyan-400 border-cyan-800/40",
            icon: Code2,
            iconBg: "bg-cyan-950/50 text-cyan-400 border border-cyan-800/30",
        };
    }

    return {
        tag: "DESIGN",
        colorClass: "bg-indigo-950/40 text-indigo-400 border-indigo-800/40",
        icon: Layers,
        iconBg: "bg-indigo-950/50 text-indigo-400 border border-indigo-800/30",
    };
}

export default function ExamTemplatesPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [selectedTemplate, setSelectedTemplate] =
        useState<ExamTemplateDTO | null>(null);
    const [previewTemplateId, setPreviewTemplateId] =
        useState<number | null>(null);
    const [selectedTopicFilter, setSelectedTopicFilter] =
        useState<string>("all");

    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [examTitle, setExamTitle] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    const {
        data: templates = [],
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ["exam-templates"],
        queryFn: () => examTemplateApi.list(),
    });

    const {
        data: previewTemplate,
        isLoading: isLoadingPreview,
    } = useQuery({
        queryKey: ["exam-template-preview", previewTemplateId],
        queryFn: () =>
            previewTemplateId ? examTemplateApi.get(previewTemplateId) : null,
        enabled: previewTemplateId !== null,
    });

    const topicStats = useMemo(() => {
        if (!previewTemplate?.questions) return [];
        const map = new Map<string, number>();
        for (const q of previewTemplate.questions) {
            const topic =
                q.topic && q.topic.trim() ? q.topic.trim() : "Unassigned";
            map.set(topic, (map.get(topic) || 0) + 1);
        }
        return Array.from(map.entries())
            .map(([topic, count]) => ({ topic, count }))
            .sort((a, b) => b.count - a.count);
    }, [previewTemplate]);

    const difficultyStats = useMemo(() => {
        if (!previewTemplate?.questions)
            return { easy: 0, medium: 0, hard: 0 };
        let easy = 0,
            medium = 0,
            hard = 0;
        for (const q of previewTemplate.questions) {
            if (q.difficulty === "EASY") easy++;
            else if (q.difficulty === "HARD") hard++;
            else medium++;
        }
        return { easy, medium, hard };
    }, [previewTemplate]);

    const displayedQuestions = useMemo(() => {
        if (!previewTemplate?.questions) return [];
        if (selectedTopicFilter === "all") return previewTemplate.questions;
        return previewTemplate.questions.filter((q) => {
            const topic =
                q.topic && q.topic.trim() ? q.topic.trim() : "Unassigned";
            return topic === selectedTopicFilter;
        });
    }, [previewTemplate, selectedTopicFilter]);

    const filteredTemplates = useMemo(() => {
        return templates.filter((template) => {
            const search = searchQuery.toLowerCase();
            const matchesSearch =
                template.name.toLowerCase().includes(search) ||
                (template.description?.toLowerCase().includes(search) ?? false);

            if (!matchesSearch) return false;
            if (activeFilter === "all") return true;
            if (activeFilter === "java") {
                return template.name.toLowerCase().includes("java");
            }
            if (activeFilter === "python") {
                return template.name.toLowerCase().includes("python");
            }
            if (activeFilter === "architecture") {
                const name = template.name.toLowerCase();
                return name.includes("architecture") || name.includes("design");
            }
            if (activeFilter === "drafts") {
                return (template.questionCount ?? 0) === 0;
            }
            return true;
        });
    }, [templates, searchQuery, activeFilter]);

    const createExamMutation = useMutation({
        mutationFn: () => {
            if (!selectedTemplate) {
                throw new Error("Please select a template");
            }
            if (!examTitle.trim()) {
                throw new Error("Exam title is required");
            }
            if (startTime && endTime && endTime <= startTime) {
                throw new Error("End time must be later than start time");
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
            closeCreateDialog();
            navigate("/exams");
        },
        onError: (error) => {
            toast.error(
                error instanceof Error
                    ? error.message
                    : "Failed to create exam from template",
            );
        },
    });

    const deleteTemplateMutation = useMutation({
        mutationFn: (templateId: number) => examTemplateApi.delete(templateId),
        onSuccess: async () => {
            await queryClient.invalidateQueries({ queryKey: ["exam-templates"] });
            toast.success("Template deleted successfully");
        },
        onError: () => {
            toast.error("Failed to delete template");
        },
    });

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

    const handleDeleteTemplate = (template: ExamTemplateDTO) => {
        if (window.confirm(`Delete template "${template.name}"?`)) {
            deleteTemplateMutation.mutate(template.id);
        }
    };

    const filters = [
        { key: "all", label: "All templates" },
        { key: "java", label: "Java" },
        { key: "python", label: "Python" },
        { key: "architecture", label: "Architecture" },
        { key: "drafts", label: "Drafts" },
    ];

    return (
        <MainLayout pathName={{ exams: "Exam Management" }}>
            <section className="flex flex-col gap-5">
                {/* Match the existing Exam Management page header */}
                <header className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
                    <div>
                        <p className="text-sm text-muted-foreground">Exam Management</p>
                        <h1 className="mt-1 text-2xl font-semibold">Exam Templates</h1>
                    </div>

                    <Button variant="outline" onClick={() => navigate("/exams")}>
                        <ArrowLeft className="mr-2 size-4" />
                        Back to Exams
                    </Button>
                </header>

                {/* Search, filters, and count use the same compact layout as Exams List */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="relative w-full max-w-md">
                        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            aria-label="Search templates"
                            className="pl-9"
                            placeholder="Search by template name"
                            value={searchQuery}
                            onChange={(event) => setSearchQuery(event.target.value)}
                        />
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {filters.map((filter) => (
                            <Button
                                key={filter.key}
                                type="button"
                                size="sm"
                                variant={activeFilter === filter.key ? "default" : "outline"}
                                onClick={() => setActiveFilter(filter.key)}
                            >
                                {filter.label}
                            </Button>
                        ))}
                    </div>

                    <span className="text-sm text-muted-foreground">
                        {filteredTemplates.length} template(s)
                    </span>
                </div>

                {/* Table layout matches the existing Exam Management list */}
                <div className="overflow-hidden rounded-md border bg-background">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Template</TableHead>
                                <TableHead className="w-32">Questions</TableHead>
                                <TableHead className="w-32">Duration</TableHead>
                                <TableHead className="w-32">Attempts</TableHead>
                                <TableHead className="w-40">Status</TableHead>
                                <TableHead className="w-64 text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>

                        <TableBody>
                            {isLoading && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        Loading templates...
                                    </TableCell>
                                </TableRow>
                            )}

                            {isError && !isLoading && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="h-24 text-center text-destructive"
                                    >
                                        Failed to load templates.
                                        <Button
                                            variant="link"
                                            className="ml-2"
                                            onClick={() => refetch()}
                                        >
                                            Try again
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading && !isError && filteredTemplates.length === 0 && (
                                <TableRow>
                                    <TableCell
                                        colSpan={6}
                                        className="h-24 text-center text-muted-foreground"
                                    >
                                        No matching templates found.
                                    </TableCell>
                                </TableRow>
                            )}

                            {!isLoading &&
                                !isError &&
                                filteredTemplates.map((template) => {
                                    const category = getTemplateCategory(template.name);
                                    const CategoryIcon = category.icon;
                                    const isReady = (template.questionCount ?? 0) > 0;

                                    return (
                                        <TableRow key={template.id}>
                                            <TableCell className="min-w-[260px]">
                                                <div className="flex items-start gap-3">
                                                    <div
                                                        className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md ${category.iconBg}`}
                                                    >
                                                        <CategoryIcon className="size-4" />
                                                    </div>

                                                    <div className="min-w-0">
                                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                                            <Badge
                                                                variant="outline"
                                                                className={category.colorClass}
                                                            >
                                                                {category.tag}
                                                            </Badge>
                                                            <span
                                                                className={`text-xs ${
                                                                    isReady
                                                                        ? "text-emerald-500"
                                                                        : "text-amber-500"
                                                                }`}
                                                            >
                                                                {isReady ? "Ready" : "Draft"}
                                                            </span>
                                                        </div>

                                                        <button
                                                            type="button"
                                                            className="text-left font-medium hover:underline focus:outline-none"
                                                            onClick={() => setPreviewTemplateId(template.id)}
                                                        >
                                                            {template.name}
                                                        </button>
                                                        {template.description && (
                                                            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">
                                                                {template.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>

                                            <TableCell>
                                                <span className="inline-flex items-center gap-2">
                                                    <HelpCircle className="size-4 text-muted-foreground" />
                                                    {template.questionCount ?? 0}
                                                </span>
                                            </TableCell>

                                            <TableCell>
                                                <span className="inline-flex items-center gap-2">
                                                    <Clock className="size-4 text-muted-foreground" />
                                                    {template.durationMinutes ?? 0} mins
                                                </span>
                                            </TableCell>

                                            <TableCell>
                                                <span className="inline-flex items-center gap-2">
                                                    <ShieldCheck className="size-4 text-muted-foreground" />
                                                    {template.maxAttempts != null
                                                        ? template.maxAttempts
                                                        : "Unlimited"}
                                                </span>
                                            </TableCell>

                                            <TableCell>
                                                <Badge
                                                    variant="outline"
                                                    className={
                                                        isReady
                                                            ? "border-emerald-800/50 text-emerald-500"
                                                            : "border-amber-800/50 text-amber-500"
                                                    }
                                                >
                                                    {isReady ? "Ready to use" : "Draft"}
                                                </Badge>
                                            </TableCell>

                                            <TableCell>
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={() => openCreateDialog(template)}
                                                    >
                                                        <BookmarkPlus className="mr-2 size-4" />
                                                        Use Template
                                                    </Button>

                                                    {/* Nút Xem trước (Preview) ở bên trái thùng rác */}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Preview ${template.name}`}
                                                        title="Preview template questions"
                                                        onClick={() => setPreviewTemplateId(template.id)}
                                                    >
                                                        <Eye className="size-4 text-muted-foreground hover:text-foreground" />
                                                    </Button>

                                                    {/* Nút Thùng rác (Xóa) */}
                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`Delete ${template.name}`}
                                                        title="Delete template"
                                                        disabled={deleteTemplateMutation.isPending}
                                                        onClick={() => handleDeleteTemplate(template)}
                                                    >
                                                        <Trash2 className="size-4 text-muted-foreground hover:text-destructive" />
                                                    </Button>

                                                    <Button
                                                        type="button"
                                                        variant="ghost"
                                                        size="icon"
                                                        aria-label={`More options for ${template.name}`}
                                                        title="More options"
                                                        onClick={() =>
                                                            toast.info(
                                                                "Use the available actions to manage this template.",
                                                            )
                                                        }
                                                    >
                                                        <MoreVertical className="size-4" />
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                        </TableBody>
                    </Table>
                </div>
            </section>

            {/* Create Exam from Template dialog */}
            <Dialog
                open={selectedTemplate !== null}
                onOpenChange={(open) => {
                    if (!open) closeCreateDialog();
                }}
            >
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Create Exam from Template</DialogTitle>
                        <DialogDescription>
                            The template configuration and question bank will be cloned
                            into a new exam.
                        </DialogDescription>
                    </DialogHeader>

                    {selectedTemplate && (
                        <div className="space-y-4 py-2">
                            <div className="rounded-md border bg-muted/30 p-3">
                                <p className="font-medium">{selectedTemplate.name}</p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {selectedTemplate.questionCount ?? 0} questions ·{" "}
                                    {selectedTemplate.durationMinutes ?? 0} minutes
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label
                                    htmlFor="new-exam-title"
                                    className="text-sm font-medium"
                                >
                                    New exam title
                                </label>
                                <Input
                                    id="new-exam-title"
                                    value={examTitle}
                                    onChange={(event) => setExamTitle(event.target.value)}
                                    placeholder="Enter exam title"
                                    maxLength={200}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <label
                                        htmlFor="new-exam-start"
                                        className="text-sm font-medium"
                                    >
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
                                    <label
                                        htmlFor="new-exam-end"
                                        className="text-sm font-medium"
                                    >
                                        End time (optional)
                                    </label>
                                    <Input
                                        id="new-exam-end"
                                        type="datetime-local"
                                        value={endTime}
                                        onChange={(event) => setEndTime(event.target.value)}
                                    />
                                </div>
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
                            {createExamMutation.isPending ? "Creating..." : "Create Exam"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Preview Template Dialog */}
            <Dialog
                open={previewTemplateId !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPreviewTemplateId(null);
                        setSelectedTopicFilter("all");
                    }
                }}
            >
                <DialogContent className="flex max-h-[92vh] w-[96vw] flex-col overflow-hidden p-0 sm:max-w-5xl lg:max-w-6xl">
                    <DialogHeader className="shrink-0 border-b bg-background p-6 pb-4">
                        <div className="flex flex-col gap-1 text-left">
                            <DialogTitle className="text-xl font-bold">
                                {previewTemplate?.name || "Template Preview"}
                            </DialogTitle>
                            {previewTemplate?.description && (
                                <DialogDescription className="text-sm">
                                    {previewTemplate.description}
                                </DialogDescription>
                            )}
                        </div>

                        {previewTemplate && (
                            <div className="flex flex-wrap items-center gap-2 pt-2">
                                <Badge variant="outline" className="gap-1">
                                    <Clock className="size-3.5" />
                                    {previewTemplate.durationMinutes ?? 0} mins
                                </Badge>
                                <Badge variant="outline" className="gap-1">
                                    <HelpCircle className="size-3.5" />
                                    {previewTemplate.questions?.length ?? previewTemplate.questionCount ?? 0} questions
                                </Badge>
                                <Badge variant="outline" className="gap-1">
                                    <ShieldCheck className="size-3.5" />
                                    {previewTemplate.maxAttempts != null
                                        ? `${previewTemplate.maxAttempts} attempts`
                                        : "Unlimited attempts"}
                                </Badge>
                            </div>
                        )}
                    </DialogHeader>

                    {/* 2-Column Split: Left Sidebar for Topics & Navigation, Right for Questions */}
                    <div className="flex flex-1 overflow-hidden min-h-0">
                        {/* Left Sidebar */}
                        <aside className="w-64 sm:w-72 shrink-0 border-r bg-muted/10 p-4 overflow-y-auto space-y-5">
                            {/* Chủ đề / Topics */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        Chủ đề (Topics)
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                        {topicStats.length} topics
                                    </span>
                                </div>

                                <div className="flex flex-col gap-1">
                                    <button
                                        type="button"
                                        onClick={() => setSelectedTopicFilter("all")}
                                        className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                                            selectedTopicFilter === "all"
                                                ? "bg-primary text-primary-foreground shadow-xs"
                                                : "hover:bg-muted text-foreground"
                                        }`}
                                    >
                                        <span className="truncate">Tất cả câu hỏi</span>
                                        <Badge
                                            variant={selectedTopicFilter === "all" ? "outline" : "secondary"}
                                            className={`ml-2 text-xs shrink-0 ${
                                                selectedTopicFilter === "all"
                                                    ? "border-primary-foreground/30 text-primary-foreground"
                                                    : ""
                                            }`}
                                        >
                                            {previewTemplate?.questions?.length ?? 0}
                                        </Badge>
                                    </button>

                                    {topicStats.map(({ topic, count }) => {
                                        const isSelected = selectedTopicFilter === topic;
                                        return (
                                            <button
                                                key={topic}
                                                type="button"
                                                onClick={() => setSelectedTopicFilter(topic)}
                                                className={`flex items-center justify-between w-full px-3 py-2 rounded-md text-xs font-medium transition-colors text-left ${
                                                    isSelected
                                                        ? "bg-primary text-primary-foreground shadow-xs"
                                                        : "hover:bg-muted text-foreground"
                                                }`}
                                            >
                                                <span className="truncate font-mono">{topic}</span>
                                                <Badge
                                                    variant={isSelected ? "outline" : "secondary"}
                                                    className={`ml-2 text-xs shrink-0 ${
                                                        isSelected
                                                            ? "border-primary-foreground/30 text-primary-foreground"
                                                            : ""
                                                    }`}
                                                >
                                                    {count}
                                                </Badge>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Thống kê độ khó */}
                            <div className="border-t pt-4">
                                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground block mb-2.5">
                                    Phân bố độ khó
                                </span>
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium">
                                        <span>Dễ (Easy)</span>
                                        <span className="font-semibold">{difficultyStats.easy} câu</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs p-2 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 font-medium">
                                        <span>Trung bình (Medium)</span>
                                        <span className="font-semibold">{difficultyStats.medium} câu</span>
                                    </div>
                                    <div className="flex items-center justify-between text-xs p-2 rounded-md bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 font-medium">
                                        <span>Khó (Hard)</span>
                                        <span className="font-semibold">{difficultyStats.hard} câu</span>
                                    </div>
                                </div>
                            </div>

                            {/* Bảng điều hướng nhanh số câu hỏi */}
                            {previewTemplate?.questions && previewTemplate.questions.length > 0 && (
                                <div className="border-t pt-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                            Nhảy nhanh câu hỏi
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto pr-1">
                                        {previewTemplate.questions.map((q, idx) => {
                                            const isMatchedFilter =
                                                selectedTopicFilter === "all" ||
                                                (q.topic && q.topic.trim() ? q.topic.trim() : "Unassigned") ===
                                                    selectedTopicFilter;

                                            return (
                                                <button
                                                    key={q.id || idx}
                                                    type="button"
                                                    title={`Question ${idx + 1}: ${q.topic || "No topic"}`}
                                                    onClick={() => {
                                                        if (!isMatchedFilter) {
                                                            setSelectedTopicFilter("all");
                                                        }
                                                        setTimeout(() => {
                                                            document
                                                                .getElementById(`preview-question-${q.id || idx}`)
                                                                ?.scrollIntoView({
                                                                    behavior: "smooth",
                                                                    block: "start",
                                                                });
                                                        }, 50);
                                                    }}
                                                    className={`flex size-8 items-center justify-center rounded-md text-xs font-medium transition-all ${
                                                        isMatchedFilter
                                                            ? "bg-card border hover:border-primary hover:text-primary shadow-2xs font-semibold"
                                                            : "opacity-30 bg-muted border border-dashed"
                                                    }`}
                                                >
                                                    {idx + 1}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </aside>

                        {/* Right Main Content */}
                        <main className="flex-1 space-y-4 overflow-y-auto overflow-x-hidden p-6">
                            {/* Filter bar indicator */}
                            {selectedTopicFilter !== "all" && (
                                <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3.5 py-2 text-xs">
                                    <span>
                                        Đang lọc theo chủ đề:{" "}
                                        <strong className="font-mono text-primary">{selectedTopicFilter}</strong> (
                                        {displayedQuestions.length} câu)
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs text-muted-foreground hover:text-foreground"
                                        onClick={() => setSelectedTopicFilter("all")}
                                    >
                                        Hiện tất cả
                                    </Button>
                                </div>
                            )}

                            {isLoadingPreview ? (
                                <div className="py-12 text-center text-muted-foreground">
                                    Loading template questions...
                                </div>
                            ) : displayedQuestions.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground">
                                    Không tìm thấy câu hỏi nào thuộc chủ đề này.
                                </div>
                            ) : (
                                displayedQuestions.map((question, qIdx) => {
                                    // Tìm số thứ tự gốc trong toàn bộ câu hỏi
                                    const originalIndex =
                                        previewTemplate?.questions?.findIndex(
                                            (q) => (q.id && q.id === question.id) || q === question
                                        ) ?? qIdx;

                                    return (
                                        <div
                                            key={question.id || qIdx}
                                            id={`preview-question-${question.id || originalIndex}`}
                                            className="space-y-3 rounded-lg border bg-card p-4 shadow-xs"
                                        >
                                            <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-2.5">
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <span className="text-sm font-semibold whitespace-nowrap">
                                                        Question {originalIndex + 1}
                                                    </span>
                                                    <Badge variant="secondary" className="text-xs">
                                                        {question.type === "MULTIPLE_CHOICE"
                                                            ? "Multiple Choice"
                                                            : "Essay"}
                                                    </Badge>
                                                    <Badge
                                                        variant="outline"
                                                        className={`text-xs ${
                                                            question.difficulty === "EASY"
                                                                ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/5"
                                                                : question.difficulty === "HARD"
                                                                ? "border-rose-500/30 text-rose-500 bg-rose-500/5"
                                                                : "border-amber-500/30 text-amber-500 bg-amber-500/5"
                                                        }`}
                                                    >
                                                        {question.difficulty}
                                                    </Badge>
                                                    {question.topic && (
                                                        <Badge variant="outline" className="text-xs text-muted-foreground bg-muted/40 font-mono">
                                                            {question.topic}
                                                        </Badge>
                                                    )}
                                                </div>
                                                <span className="text-xs font-medium text-muted-foreground whitespace-nowrap bg-muted/60 px-2.5 py-0.5 rounded">
                                                    {question.points}{" "}
                                                    {question.points === 1 ? "pt" : "pts"}
                                                </span>
                                            </div>

                                            <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">
                                                {question.content}
                                            </p>

                                            {/* Options */}
                                            {question.options && question.options.length > 0 && (
                                                <div className="grid grid-cols-1 gap-2 pt-1">
                                                    {question.options.map((opt, oIdx) => {
                                                        const letter = String.fromCharCode(65 + oIdx);
                                                        const isCorrect = Boolean(opt.correct ?? opt.isCorrect);

                                                        return (
                                                            <div
                                                                key={opt.id || oIdx}
                                                                className={`flex items-start gap-3 rounded-lg border p-3 text-sm transition-colors ${
                                                                    isCorrect
                                                                        ? "border-emerald-500 bg-emerald-500/10 font-medium text-emerald-950 dark:text-emerald-200 shadow-xs"
                                                                        : "border-border/60 bg-muted/20 text-muted-foreground"
                                                                }`}
                                                            >
                                                                <span
                                                                    className={`inline-flex size-6 shrink-0 items-center justify-center rounded-md text-xs font-semibold ${
                                                                        isCorrect
                                                                            ? "bg-emerald-600 text-white"
                                                                            : "border bg-muted text-foreground/80"
                                                                    }`}
                                                                >
                                                                    {letter}
                                                                </span>
                                                                <span className="flex-1 pt-0.5 leading-relaxed break-words">
                                                                    {opt.content}
                                                                </span>
                                                                {isCorrect && (
                                                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                                                                        ✓ Đáp án đúng
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            )}
                        </main>
                    </div>

                    <DialogFooter className="flex shrink-0 items-center justify-between border-t bg-muted/20 p-4 sm:justify-between">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setPreviewTemplateId(null);
                                setSelectedTopicFilter("all");
                            }}
                        >
                            Close
                        </Button>
                        {previewTemplate && (
                            <Button
                                type="button"
                                onClick={() => {
                                    const tmpl = previewTemplate;
                                    setPreviewTemplateId(null);
                                    setSelectedTopicFilter("all");
                                    openCreateDialog(tmpl);
                                }}
                            >
                                <BookmarkPlus className="mr-2 size-4" />
                                Use this Template
                            </Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
