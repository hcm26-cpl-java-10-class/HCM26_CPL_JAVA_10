
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
    BookmarkPlus,
    Trash2,
    Clock,
    HelpCircle,
    ShieldCheck,
    Search,
    Coffee,
    Code2,
    Layers,
    MoreVertical,
    Plus,
    ArrowLeft,
    FileText,
    SlidersHorizontal,
} from "lucide-react";

import { examTemplateApi } from "@/api";
import type { ExamTemplateDTO } from "@/api/features/exam-template.api";
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

// Determine category, styling, and icon based on template name.
function getTemplateCategory(name: string) {
    const lower = name.toLowerCase();

    if (lower.includes("java")) {
        return {
            tag: "JAVA",
            colorClass:
                "bg-amber-950/40 text-amber-400 border-amber-800/40",
            icon: Coffee,
            iconBg:
                "bg-amber-950/50 text-amber-400 border border-amber-800/30",
        };
    }

    if (lower.includes("python")) {
        return {
            tag: "PYTHON",
            colorClass:
                "bg-cyan-950/40 text-cyan-400 border-cyan-800/40",
            icon: Code2,
            iconBg:
                "bg-cyan-950/50 text-cyan-400 border border-cyan-800/30",
        };
    }

    return {
        tag: "DESIGN",
        colorClass:
            "bg-indigo-950/40 text-indigo-400 border-indigo-800/40",
        icon: Layers,
        iconBg:
            "bg-indigo-950/50 text-indigo-400 border border-indigo-800/30",
    };
}

const FILTERS = [
    { key: "all", label: "All Templates" },
    { key: "java", label: "Java" },

];

export default function ExamTemplatesPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [selectedTemplate, setSelectedTemplate] =
        useState<ExamTemplateDTO | null>(null);

    const [searchQuery, setSearchQuery] = useState("");
    const [activeFilter, setActiveFilter] = useState("all");
    const [examTitle, setExamTitle] = useState("");
    const [startTime, setStartTime] = useState("");
    const [endTime, setEndTime] = useState("");

    // Fetch templates.
    const {
        data: templates = [],
        isLoading,
        isError,
        refetch,
    } = useQuery({
        queryKey: ["exam-templates"],
        queryFn: () => examTemplateApi.list(),
    });

    // Search and filter templates on the client.
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

                return (
                    name.includes("architecture") ||
                    name.includes("design")
                );
            }

            if (activeFilter === "drafts") {
                return (template.questionCount ?? 0) === 0;
            }

            return true;
        });
    }, [templates, searchQuery, activeFilter]);

    // Create an exam from a selected template.
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
            await queryClient.invalidateQueries({
                queryKey: ["exams"],
            });

            toast.success("New exam created from template successfully");
            closeCreateDialog();
        },

        onError: (error) => {
            const message =
                error instanceof Error
                    ? error.message
                    : "Failed to create exam from template";

            toast.error(message);
        },
    });

    // Delete a template.
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

    const openCreateDialog = (template: ExamTemplateDTO) => {
        setSelectedTemplate(template);

        setExamTitle(
            template.name.replace(/\s*-\s*Template\s*$/i, "")
        );

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
        if (
            window.confirm(
                `Delete template "${template.name}"? This action cannot be undone.`
            )
        ) {
            deleteTemplateMutation.mutate(template.id);
        }
    };

    return (
        <div className="min-h-screen bg-[#0b0f17] text-slate-100">
            <main className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
                {/* Page Header */}
                <header className="flex flex-col gap-5 border-b border-slate-800 pb-6 md:flex-row md:items-center md:justify-between">
                    <div className="flex items-center gap-4">
                        <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => navigate("/exams")}
                            aria-label="Back to exam management"
                            className="size-11 shrink-0 rounded-xl border-slate-700 bg-[#121824] text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                            <ArrowLeft className="size-5" />
                        </Button>

                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-400">
                                Exam Management
                            </p>

                            <h1 className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                                Exam Templates
                            </h1>

                            <p className="mt-2 text-sm text-slate-400">
                                Browse, organize, and create exams from saved templates.
                            </p>
                        </div>
                    </div>

                    <Button
                        type="button"
                        onClick={() =>
                            toast.info("Select a template below to create an exam.")
                        }
                        className="h-11 gap-2 rounded-xl bg-indigo-600 px-5 font-semibold text-white shadow-lg shadow-indigo-950/30 hover:bg-indigo-500"
                    >
                        <Plus className="size-4" />
                        New Exam from Template
                    </Button>
                </header>

                {/* Overview Cards */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-2xl border border-slate-800 bg-[#121824] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-400">
                                    Total Templates
                                </p>
                                <p className="mt-2 text-3xl font-bold text-white">
                                    {templates.length}
                                </p>
                            </div>

                            <div className="flex size-12 items-center justify-center rounded-xl border border-indigo-800/40 bg-indigo-950/40 text-indigo-400">
                                <Layers className="size-6" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-[#121824] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-400">
                                    Ready to Use
                                </p>
                                <p className="mt-2 text-3xl font-bold text-white">
                                    {
                                        templates.filter(
                                            (template) => (template.questionCount ?? 0) > 0
                                        ).length
                                    }
                                </p>
                            </div>

                            <div className="flex size-12 items-center justify-center rounded-xl border border-emerald-800/40 bg-emerald-950/40 text-emerald-400">
                                <ShieldCheck className="size-6" />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-800 bg-[#121824] p-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-slate-400">
                                    Draft Templates
                                </p>
                                <p className="mt-2 text-3xl font-bold text-white">
                                    {
                                        templates.filter(
                                            (template) => (template.questionCount ?? 0) === 0
                                        ).length
                                    }
                                </p>
                            </div>

                            <div className="flex size-12 items-center justify-center rounded-xl border border-amber-800/40 bg-amber-950/40 text-amber-400">
                                <FileText className="size-6" />
                            </div>
                        </div>
                    </div>
                </section>

                {/* Search and Filters */}
                <section className="space-y-4 rounded-2xl border border-slate-800 bg-[#101621] p-4 sm:p-5">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                        <div className="relative w-full xl:max-w-md">
                            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />

                            <Input
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                placeholder="Search by template name or description..."
                                aria-label="Search templates"
                                className="h-11 w-full rounded-xl border-slate-700 bg-[#0b0f17] pl-10 text-sm text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                            />
                        </div>

                        <div className="flex items-center gap-2 text-sm text-slate-400">
                            <SlidersHorizontal className="size-4 shrink-0" />
                            <span>Filter templates</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        {FILTERS.map((filter) => {
                            const isActive = activeFilter === filter.key;

                            const count =
                                filter.key === "all"
                                    ? templates.length
                                    : filter.key === "java"
                                        ? templates.filter((template) =>
                                            template.name.toLowerCase().includes("java")
                                        ).length
                                        : filter.key === "python"
                                            ? templates.filter((template) =>
                                                template.name.toLowerCase().includes("python")
                                            ).length
                                            : filter.key === "architecture"
                                                ? templates.filter((template) => {
                                                    const name = template.name.toLowerCase();

                                                    return (
                                                        name.includes("architecture") ||
                                                        name.includes("design")
                                                    );
                                                }).length
                                                : templates.filter(
                                                    (template) =>
                                                        (template.questionCount ?? 0) === 0
                                                ).length;

                            return (
                                <button
                                    key={filter.key}
                                    type="button"
                                    onClick={() => setActiveFilter(filter.key)}
                                    className={`rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
                                        isActive
                                            ? "border-indigo-500/50 bg-indigo-600/15 text-indigo-300"
                                            : "border-slate-700 bg-[#151d2a] text-slate-400 hover:border-slate-600 hover:text-white"
                                    }`}
                                >
                                    {filter.label} ({count})
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Template List Heading */}
                <section className="space-y-5">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                        <div>
                            <h2 className="text-xl font-bold text-white">
                                Available Templates
                            </h2>
                            <p className="mt-1 text-sm text-slate-400">
                                Choose a template to configure and create a new exam.
                            </p>
                        </div>

                        <p className="text-sm text-slate-400">
                            Showing{" "}
                            <span className="font-semibold text-white">
                {filteredTemplates.length}
              </span>{" "}
                            of{" "}
                            <span className="font-semibold text-white">
                {templates.length}
              </span>{" "}
                            templates
                        </p>
                    </div>

                    {/* Loading State */}
                    {isLoading && (
                        <div className="rounded-2xl border border-slate-800 bg-[#121824] p-16 text-center">
                            <div className="mx-auto size-8 animate-spin rounded-full border-2 border-slate-700 border-t-indigo-500" />
                            <p className="mt-4 text-sm text-slate-400">
                                Loading templates...
                            </p>
                        </div>
                    )}

                    {/* Error State */}
                    {isError && !isLoading && (
                        <div className="rounded-2xl border border-rose-900/40 bg-rose-950/20 p-10 text-center">
                            <p className="font-medium text-rose-300">
                                Failed to load templates.
                            </p>

                            <p className="mt-2 text-sm text-slate-400">
                                Please check your connection and try again.
                            </p>

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => refetch()}
                                className="mt-5 border-rose-800 text-rose-200 hover:bg-rose-950/40"
                            >
                                Try Again
                            </Button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading &&
                        !isError &&
                        filteredTemplates.length === 0 && (
                            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#121824]/60 px-6 py-16 text-center">
                                <div className="mx-auto flex size-14 items-center justify-center rounded-2xl border border-slate-700 bg-[#0b0f17]">
                                    <BookmarkPlus className="size-7 text-slate-500" />
                                </div>

                                <h3 className="mt-4 text-lg font-semibold text-white">
                                    No templates found
                                </h3>

                                <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                                    Try another search term or choose a different filter
                                    to find the template you need.
                                </p>

                                {(searchQuery || activeFilter !== "all") && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => {
                                            setSearchQuery("");
                                            setActiveFilter("all");
                                        }}
                                        className="mt-5 border-slate-700 text-slate-300 hover:bg-slate-800"
                                    >
                                        Clear Filters
                                    </Button>
                                )}
                            </div>
                        )}

                    {/* Responsive Desktop Template Grid */}
                    {!isLoading &&
                        !isError &&
                        filteredTemplates.length > 0 && (
                            <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                                {filteredTemplates.map((template) => {
                                    const category = getTemplateCategory(template.name);
                                    const CategoryIcon = category.icon;
                                    const isReady = (template.questionCount ?? 0) > 0;

                                    return (
                                        <article
                                            key={template.id}
                                            className="flex h-full min-w-0 flex-col gap-5 rounded-2xl border border-slate-800 bg-[#121824] p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-500/40 hover:shadow-xl hover:shadow-black/20"
                                        >
                                            {/* Card Header */}
                                            <div className="flex items-start gap-3">
                                                <div
                                                    className={`flex size-12 shrink-0 items-center justify-center rounded-xl ${category.iconBg}`}
                                                >
                                                    <CategoryIcon className="size-6" />
                                                </div>

                                                <div className="min-w-0 flex-1">
                                                    <div className="mb-2 flex flex-wrap items-center gap-2">
                                                        <Badge
                                                            variant="outline"
                                                            className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${category.colorClass}`}
                                                        >
                                                            {category.tag}
                                                        </Badge>

                                                        <span
                                                            className={`inline-flex items-center gap-1.5 text-xs font-medium ${
                                                                isReady
                                                                    ? "text-emerald-400"
                                                                    : "text-amber-400"
                                                            }`}
                                                        >
                              <span
                                  className={`size-1.5 rounded-full ${
                                      isReady
                                          ? "bg-emerald-400"
                                          : "bg-amber-400"
                                  }`}
                              />
                                                            {isReady ? "Ready" : "Draft"}
                            </span>
                                                    </div>

                                                    <h3
                                                        title={template.name}
                                                        className="break-words text-base font-bold leading-snug text-white"
                                                    >
                                                        {template.name}
                                                    </h3>
                                                </div>

                                                <button
                                                    type="button"
                                                    aria-label={`Options for ${template.name}`}
                                                    onClick={() =>
                                                        toast.info(
                                                            "Use the delete button below to remove this template."
                                                        )
                                                    }
                                                    className="shrink-0 rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-800 hover:text-white"
                                                >
                                                    <MoreVertical className="size-4" />
                                                </button>
                                            </div>

                                            {/* Template Description */}
                                            <p className="min-h-10 text-sm leading-relaxed text-slate-400">
                                                {template.description?.trim() ||
                                                    "No description has been added for this template."}
                                            </p>

                                            {/* Template Statistics */}
                                            <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800/80 bg-[#0b101a] p-3">
                                                <div className="min-w-0 border-r border-slate-800/80 pr-2">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <HelpCircle className="size-3.5 shrink-0 text-slate-500" />
                                                        <span>Questions</span>
                                                    </div>

                                                    <p className="mt-2 text-sm font-bold text-slate-100">
                                                        {template.questionCount ?? 0}
                                                    </p>
                                                </div>

                                                <div className="min-w-0 border-r border-slate-800/80 px-2">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <Clock className="size-3.5 shrink-0 text-slate-500" />
                                                        <span>Duration</span>
                                                    </div>

                                                    <p className="mt-2 text-sm font-bold text-slate-100">
                                                        {template.durationMinutes ?? 0} min
                                                    </p>
                                                </div>

                                                <div className="min-w-0 pl-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                                                        <ShieldCheck className="size-3.5 shrink-0 text-slate-500" />
                                                        <span>Attempts</span>
                                                    </div>

                                                    <p className="mt-2 break-words text-sm font-bold text-slate-100">
                                                        {template.maxAttempts != null
                                                            ? template.maxAttempts
                                                            : "Unlimited"}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Card Actions */}
                                            <div className="mt-auto flex items-center gap-3 border-t border-slate-800 pt-4">
                                                <Button
                                                    type="button"
                                                    onClick={() => openCreateDialog(template)}
                                                    className="h-10 flex-1 gap-2 rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-500"
                                                >
                                                    <BookmarkPlus className="size-4" />
                                                    Use Template
                                                </Button>

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    aria-label={`Delete ${template.name}`}
                                                    disabled={deleteTemplateMutation.isPending}
                                                    onClick={() => handleDeleteTemplate(template)}
                                                    className="size-10 shrink-0 rounded-xl border-slate-700 bg-[#0e1420] text-slate-400 hover:border-rose-900/50 hover:bg-rose-950/20 hover:text-rose-400"
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                </section>

                {/* Create Exam Dialog */}
                <Dialog
                    open={selectedTemplate !== null}
                    onOpenChange={(open) => {
                        if (!open) closeCreateDialog();
                    }}
                >
                    <DialogContent className="rounded-2xl border-slate-800 bg-[#121824] text-slate-100 sm:max-w-lg">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-bold text-white">
                                Create Exam from Template
                            </DialogTitle>

                            <DialogDescription className="text-sm leading-relaxed text-slate-400">
                                Create a new exam using the selected template's
                                configuration and question bank.
                            </DialogDescription>
                        </DialogHeader>

                        {selectedTemplate && (
                            <div className="space-y-5 py-2">
                                {/* Selected Template Summary */}
                                <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-[#0b101a] p-4">
                                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-950/50 text-indigo-400">
                                        {(() => {
                                            const Icon = getTemplateCategory(
                                                selectedTemplate.name
                                            ).icon;

                                            return <Icon className="size-5" />;
                                        })()}
                                    </div>

                                    <div className="min-w-0 flex-1">
                                        <p className="break-words font-semibold text-white">
                                            {selectedTemplate.name}
                                        </p>

                                        <p className="mt-1 text-sm text-slate-400">
                                            {selectedTemplate.questionCount ?? 0} questions
                                            {" · "}
                                            {selectedTemplate.durationMinutes ?? 0} minutes
                                        </p>
                                    </div>
                                </div>

                                {/* Exam Title */}
                                <div className="space-y-2">
                                    <label
                                        htmlFor="new-exam-title"
                                        className="text-sm font-medium text-slate-300"
                                    >
                                        New Exam Title
                                    </label>

                                    <Input
                                        id="new-exam-title"
                                        value={examTitle}
                                        onChange={(event) =>
                                            setExamTitle(event.target.value)
                                        }
                                        placeholder="Enter exam title"
                                        maxLength={200}
                                        className="h-11 rounded-xl border-slate-700 bg-[#0b101a] text-sm text-white placeholder:text-slate-500 focus-visible:ring-indigo-500"
                                    />
                                </div>

                                {/* Schedule */}
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div className="space-y-2">
                                        <label
                                            htmlFor="new-exam-start"
                                            className="text-sm font-medium text-slate-300"
                                        >
                                            Start Time
                                            <span className="ml-1 font-normal text-slate-500">
                        (Optional)
                      </span>
                                        </label>

                                        <Input
                                            id="new-exam-start"
                                            type="datetime-local"
                                            value={startTime}
                                            onChange={(event) =>
                                                setStartTime(event.target.value)
                                            }
                                            className="h-11 min-w-0 rounded-xl border-slate-700 bg-[#0b101a] text-sm text-white focus-visible:ring-indigo-500"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label
                                            htmlFor="new-exam-end"
                                            className="text-sm font-medium text-slate-300"
                                        >
                                            End Time
                                            <span className="ml-1 font-normal text-slate-500">
                        (Optional)
                      </span>
                                        </label>

                                        <Input
                                            id="new-exam-end"
                                            type="datetime-local"
                                            value={endTime}
                                            onChange={(event) =>
                                                setEndTime(event.target.value)
                                            }
                                            className="h-11 min-w-0 rounded-xl border-slate-700 bg-[#0b101a] text-sm text-white focus-visible:ring-indigo-500"
                                        />
                                    </div>
                                </div>

                                {startTime &&
                                    endTime &&
                                    endTime <= startTime && (
                                        <p className="text-sm text-rose-400">
                                            End time must be later than start time.
                                        </p>
                                    )}
                            </div>
                        )}

                        <DialogFooter className="gap-2 border-t border-slate-800 pt-4 sm:gap-3">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={closeCreateDialog}
                                disabled={createExamMutation.isPending}
                                className="rounded-xl border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                            >
                                Cancel
                            </Button>

                            <Button
                                type="button"
                                disabled={
                                    !examTitle.trim() ||
                                    createExamMutation.isPending ||
                                    (!!startTime &&
                                        !!endTime &&
                                        endTime <= startTime)
                                }
                                onClick={() => createExamMutation.mutate()}
                                className="rounded-xl bg-indigo-600 px-5 font-semibold text-white hover:bg-indigo-500"
                            >
                                {createExamMutation.isPending
                                    ? "Creating..."
                                    : "Create Exam"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </main>
        </div>
    );
}
