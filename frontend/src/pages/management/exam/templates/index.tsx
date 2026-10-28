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

                                                        <p className="font-medium">{template.name}</p>
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
        </MainLayout>
    );
}
