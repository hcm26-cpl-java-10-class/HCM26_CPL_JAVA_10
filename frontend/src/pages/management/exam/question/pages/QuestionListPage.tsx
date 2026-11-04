import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
    Calendar,
    Check,
    ChevronDown,
    ChevronUp,
    Clock,
    Eye,
    EyeOff,
    Folder,
    FolderOpen,
    FolderX,
    Layers,
    LayoutGrid,
    Pencil,
    Plus,
    Search,
    Table as TableIcon,
    Trash2,
    X,
} from "lucide-react";
import { toast } from "sonner";

import { questionApi } from "@/api";
import { entityConfig } from "../index";
import { MainLayout } from "@/components/layout/MainLayout";
import { ProTable } from "@/components/datatable/ProTable";
import ActionButton from "@/components/datatable/common/ActionButton";
import { PermissionGate } from "@/components/PermissionGate";
import { useProTable } from "@/components/datatable/hook/useProTable";
import { usePermissions } from "@/hooks/usePermissions";
import { normalizeRole, STUDENT_ROLE } from "@/utils/rbac.utils";
import { normalizeEntityActionPath, resolveEntityActionPath } from "@/router/entity-action.utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { QuestionDTO, QuestionDifficulty, QuestionType } from "@/types";

const TYPE_LABEL: Record<QuestionType, string> = {
    MULTIPLE_CHOICE: "Multiple Choice",
    ESSAY: "Essay",
    CODING: "Coding",
};

const DIFFICULTY_LABEL: Record<QuestionDifficulty, string> = {
    EASY: "Easy",
    MEDIUM: "Medium",
    HARD: "Hard",
};

const DIFFICULTY_STYLE: Record<QuestionDifficulty, { text: string; bg: string; border: string }> = {
    EASY: { text: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/30" },
    MEDIUM: { text: "text-amber-700 dark:text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/30" },
    HARD: { text: "text-red-700 dark:text-red-400", bg: "bg-red-500/10", border: "border-red-500/30" },
};

function formatDateTime(value?: string | null): string {
    if (!value) return "—";
    try {
        const d = new Date(value);
        if (isNaN(d.getTime())) return value;
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    } catch {
        return value;
    }
}

/** Render question choices / answers preview when expanded */
function QuestionAnswersPreview({ question }: { question: QuestionDTO }) {
    if (question.type === "ESSAY") {
        const criteria = question.gradingCriteria ?? [];
        if (criteria.length === 0) {
            return (
                <div className="p-3 rounded-lg bg-muted/30 text-xs italic text-muted-foreground border">
                    Tự luận — chấm điểm theo thang điểm và nội dung bài làm của thí sinh.
                </div>
            );
        }
        return (
            <div className="p-3 rounded-lg bg-muted/20 border space-y-2">
                <span className="text-xs font-semibold text-muted-foreground">Tiêu chí chấm điểm ({criteria.length}):</span>
                <ul className="space-y-1.5 divide-y divide-border/60">
                    {criteria.map((c, i) => (
                        <li key={c.id ?? i} className="pt-1.5 flex items-start justify-between gap-2 text-xs">
                            <div>
                                <span className="font-medium text-foreground">{c.name}</span>
                                {c.description && <p className="text-muted-foreground text-[11px] mt-0.5">{c.description}</p>}
                            </div>
                            <span className="font-semibold text-primary shrink-0">{c.maxPoints ?? 1} pt(s)</span>
                        </li>
                    ))}
                </ul>
            </div>
        );
    }

    if (question.type === "CODING") {
        const code = question.code;
        if (!code) {
            return (
                <div className="p-3 rounded-lg bg-muted/20 border text-xs italic text-muted-foreground">
                    Bài tập lập trình — chấm điểm tự động qua Test Cases (chưa có dữ liệu code).
                </div>
            );
        }
        const params = (code.params ?? []).map((p) => `${p.type} ${p.name}`).join(", ");
        const signature = `public static ${code.returnType} ${code.functionName}(${params})`;
        const tests = code.tests ?? [];
        const codeBlock = (title: string, body?: string | null) => (
            <div className="space-y-1">
                <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{title}</span>
                <pre className="p-2.5 rounded bg-muted/60 border font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre max-h-80 overflow-y-auto">
                    {body && body.trim() ? body : "(trống)"}
                </pre>
            </div>
        );
        return (
            <div className="p-3 rounded-lg bg-muted/20 border space-y-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-muted-foreground">Bài tập lập trình (Coding Problem):</span>
                    <code className="font-mono text-[11px] text-primary">{signature}</code>
                    {code.timeLimitSeconds ? (
                        <Badge variant="outline" className="h-4 px-1.5 text-[10px]">{code.timeLimitSeconds}s / test</Badge>
                    ) : null}
                </div>

                {codeBlock("Class Solution (starter code)", code.starterCode)}
                {codeBlock(code.customMain ? "Class Main (custom)" : "Class Main (auto-generated)", code.mainCode)}

                <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                        Test cases ({tests.length})
                    </span>
                    {tests.length === 0 ? (
                        <p className="text-muted-foreground italic">Chưa có test case.</p>
                    ) : (
                        <div className="rounded border overflow-x-auto">
                            <table className="w-full text-[11px]">
                                <thead className="bg-muted/50 text-muted-foreground">
                                    <tr>
                                        <th className="px-2 py-1 text-left font-medium w-8">#</th>
                                        <th className="px-2 py-1 text-left font-medium">Input</th>
                                        <th className="px-2 py-1 text-left font-medium">Expected</th>
                                        <th className="px-2 py-1 text-left font-medium w-16">Loại</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60 font-mono">
                                    {tests.map((t, i) => (
                                        <tr key={i}>
                                            <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                                            <td className="px-2 py-1 whitespace-pre-wrap break-all">
                                                {(code.params ?? []).map((p, k) => `${p.name} = ${t.inputs?.[k] ?? ""}`).join(", ")}
                                            </td>
                                            <td className="px-2 py-1 whitespace-pre-wrap break-all">{t.expected}</td>
                                            <td className="px-2 py-1 font-sans">
                                                <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                                                    {t.visible ? "Visible" : "Hidden"}
                                                </Badge>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    // MULTIPLE_CHOICE
    const options = question.options ?? [];
    if (options.length === 0) {
        return <p className="text-xs italic text-muted-foreground p-2">Chưa có phương án trả lời.</p>;
    }

    return (
        <div className="p-3 rounded-lg bg-muted/20 border space-y-1.5">
            <span className="text-xs font-semibold text-muted-foreground block mb-1">Các phương án trả lời:</span>
            <ul className="grid gap-1.5">
                {options.map((option, index) => {
                    const letter = String.fromCharCode(65 + index);
                    const isCorrect = Boolean(option.correct);
                    return (
                        <li
                            key={option.id ?? index}
                            className={`flex items-start gap-2 rounded px-2.5 py-1.5 text-xs transition-colors border ${isCorrect
                                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-medium border-emerald-500/30"
                                : "bg-background/60 text-muted-foreground border-transparent"
                                }`}
                        >
                            <span className={`font-semibold shrink-0 ${isCorrect ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground/70"}`}>
                                {letter}.
                            </span>
                            <span className="min-w-0 flex-1 break-words">{option.content}</span>
                            {isCorrect && (
                                <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-emerald-600 border-emerald-500/40 dark:text-emerald-400 bg-emerald-500/15 shrink-0 flex items-center gap-0.5">
                                    <Check className="size-2.5" /> Đúng
                                </Badge>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}

export default function QuestionListPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchParams, setSearchParams] = useSearchParams();
    const { activeRole } = usePermissions();

    // View Mode: 'card' (default) or 'table'
    const [viewMode, setViewMode] = useState<"card" | "table">("card");

    // Filters State
    const [keyword, setKeyword] = useState("");
    const [selectedTypes, setSelectedTypes] = useState<Set<QuestionType>>(new Set());
    const [selectedDifficulties, setSelectedDifficulties] = useState<Set<QuestionDifficulty>>(new Set());
    const initialTopic = searchParams.get("topic") || "";
    const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
    const [topicSearch, setTopicSearch] = useState("");

    // Pagination for Card View
    const [cardPage, setCardPage] = useState(0);
    const [cardPageSize, setCardPageSize] = useState(10);

    // Expandable answer preview IDs
    const [expandedIds, setExpandedIds] = useState<Set<number | string>>(new Set());

    // Dialogs
    const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);
    const [newTopicName, setNewTopicName] = useState("");
    const [deleteTarget, setDeleteTarget] = useState<QuestionDTO | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // Fetch questions summary to build filter counts and populate card view
    const { data: allQuestionsData, isLoading: isLoadingSummary, refetch: refetchQuestions } = useQuery({
        queryKey: ["question", "all-summary"],
        queryFn: () => questionApi.getPage({ page: 0, size: 2000, sort: "id,desc" }),
        staleTime: 15_000,
    });

    const allQuestions: QuestionDTO[] = allQuestionsData?.content || [];

    // Compute distinct topics & counts across question bank
    const { topics, topicCounts, typeCounts, difficultyCounts, noTopicCount } = useMemo(() => {
        const tCounts: Record<string, number> = {};
        const qTypeCounts: Record<string, number> = { MULTIPLE_CHOICE: 0, ESSAY: 0, CODING: 0 };
        const dCounts: Record<string, number> = { EASY: 0, MEDIUM: 0, HARD: 0 };
        let uncategorized = 0;

        for (const q of allQuestions) {
            // Type counts
            if (q.type && qTypeCounts[q.type] !== undefined) {
                qTypeCounts[q.type]++;
            }
            // Difficulty counts
            if (q.difficulty && dCounts[q.difficulty] !== undefined) {
                dCounts[q.difficulty]++;
            }
            // Topic counts
            const rawTopic = (q.topic || "").trim();
            if (!rawTopic) {
                uncategorized++;
                tCounts["Uncategorized"] = (tCounts["Uncategorized"] || 0) + 1;
            } else {
                tCounts[rawTopic] = (tCounts[rawTopic] || 0) + 1;
            }
        }

        const sortedTopics = Object.keys(tCounts)
            .filter((t) => t && t !== "Uncategorized")
            .sort((a, b) => a.localeCompare(b));

        return {
            topics: sortedTopics,
            topicCounts: tCounts,
            typeCounts: qTypeCounts,
            difficultyCounts: dCounts,
            noTopicCount: uncategorized,
        };
    }, [allQuestions]);

    // Multi-dimensional filtered questions
    const filteredQuestions = useMemo(() => {
        let list = allQuestions;

        // 1. Keyword search (content)
        if (keyword.trim()) {
            const q = keyword.trim().toLowerCase();
            list = list.filter((item) => (item.content || "").toLowerCase().includes(q));
        }

        // 2. Question type filter
        if (selectedTypes.size > 0) {
            list = list.filter((item) => item.type && selectedTypes.has(item.type));
        }

        // 3. Difficulty filter
        if (selectedDifficulties.size > 0) {
            list = list.filter((item) => item.difficulty && selectedDifficulties.has(item.difficulty));
        }

        // 4. Topic filter
        if (selectedTopic === "Uncategorized") {
            list = list.filter((item) => !(item.topic || "").trim());
        } else if (selectedTopic) {
            const topicLower = selectedTopic.toLowerCase();
            list = list.filter((item) => (item.topic || "").trim().toLowerCase() === topicLower);
        }

        return list;
    }, [allQuestions, keyword, selectedTypes, selectedDifficulties, selectedTopic]);

    // Reset pagination when filter criteria change
    useEffect(() => {
        setCardPage(0);
    }, [keyword, selectedTypes, selectedDifficulties, selectedTopic]);

    // Card View Paged Data
    const cardTotalPages = Math.max(1, Math.ceil(filteredQuestions.length / cardPageSize));
    const cardPagedData = useMemo(() => {
        const start = cardPage * cardPageSize;
        return filteredQuestions.slice(start, start + cardPageSize);
    }, [filteredQuestions, cardPage, cardPageSize]);

    // ProTable instance for Table View
    const dynamicSchema = useMemo(() => {
        const topicOptions = topics.map((t) => ({ label: t, value: t }));
        return {
            ...entityConfig.schema,
            fields: entityConfig.schema.fields.map((f: any) => {
                if (f.name === "topic") {
                    return { ...f, options: topicOptions, filterOptions: topicOptions };
                }
                return f;
            }),
        };
    }, [topics]);

    const table = useProTable(entityConfig.api, dynamicSchema);

    // Sync table filters to effectiveTable for Table View
    const effectiveTable = useMemo(() => {
        const start = cardPage * cardPageSize;
        const paged = filteredQuestions.slice(start, start + cardPageSize);

        return {
            ...table,
            data: paged,
            total: filteredQuestions.length,
            page: cardPage,
            size: cardPageSize,
            setPage: (p: number) => setCardPage(p),
            setSize: (s: number) => {
                setCardPageSize(s);
                setCardPage(0);
            },
            loading: isLoadingSummary,
            isFetching: isLoadingSummary,
            refetch: async () => {
                await Promise.all([table.refetch?.(), refetchQuestions?.()]);
            },
        };
    }, [table, filteredQuestions, cardPage, cardPageSize, isLoadingSummary, refetchQuestions]);

    // Toggle filter helpers
    const toggleType = (t: QuestionType) => {
        setSelectedTypes((prev) => {
            const next = new Set(prev);
            if (next.has(t)) next.delete(t);
            else next.add(t);
            return next;
        });
    };

    const toggleDifficulty = (d: QuestionDifficulty) => {
        setSelectedDifficulties((prev) => {
            const next = new Set(prev);
            if (next.has(d)) next.delete(d);
            else next.add(d);
            return next;
        });
    };

    const handleSelectTopic = (topic: string) => {
        const newTopic = selectedTopic === topic ? "" : topic;
        setSelectedTopic(newTopic);
        const newParams = new URLSearchParams(searchParams);
        if (newTopic) {
            newParams.set("topic", newTopic);
        } else {
            newParams.delete("topic");
        }
        setSearchParams(newParams, { replace: true });
    };

    const handleClearAllFilters = () => {
        setKeyword("");
        setSelectedTypes(new Set());
        setSelectedDifficulties(new Set());
        setSelectedTopic("");
        const newParams = new URLSearchParams(searchParams);
        newParams.delete("topic");
        setSearchParams(newParams, { replace: true });
    };

    const hasActiveFilters = Boolean(
        keyword || selectedTypes.size > 0 || selectedDifficulties.size > 0 || selectedTopic
    );

    const togglePreview = (id: number | string) => {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const allExpanded =
        filteredQuestions.length > 0 && filteredQuestions.every((q) => expandedIds.has(q.id));
    const toggleAllPreview = () => {
        setExpandedIds(allExpanded ? new Set() : new Set(filteredQuestions.map((q) => q.id)));
    };

    // Toggle Active Status
    const handleToggleStatus = async (id: number | string, currentActive: boolean) => {
        try {
            await table.patchField(id, "isActive", !currentActive);
            await refetchQuestions();
            toast.success("Updated question status.");
        } catch {
            toast.error("Failed to update status.");
        }
    };

    // Delete question handler
    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            setIsDeleting(true);
            await table.remove(deleteTarget.id);
            await refetchQuestions();
            await queryClient.invalidateQueries({ queryKey: ["question"] });
            setDeleteTarget(null);
            toast.success("Question deleted successfully.");
        } catch {
            toast.error("Failed to delete question.");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateWithNewTopic = () => {
        const trimmed = newTopicName.trim();
        if (!trimmed) {
            toast.error("Please enter a topic name.");
            return;
        }
        setIsNewTopicOpen(false);
        setNewTopicName("");
        navigate(`/questions/create?topic=${encodeURIComponent(trimmed)}`);
    };

    // Routing actions
    const createPage = entityConfig.actionPages?.create;
    const editPage = entityConfig.actionPages?.edit;

    const createUrl = useMemo(() => {
        if (!createPage) return "";
        const base = normalizeEntityActionPath(entityConfig.path, createPage.path);
        return selectedTopic && selectedTopic !== "Uncategorized"
            ? `${base}?topic=${encodeURIComponent(selectedTopic)}`
            : base;
    }, [createPage, selectedTopic]);

    const headerActions = useMemo(() => {
        if (!createPage) return undefined;
        return (
            <PermissionGate permission={createPage.requiredPermission || table.permission?.keys?.create}>
                <ActionButton
                    onClick={() => navigate(createUrl)}
                    tooltip={
                        selectedTopic && selectedTopic !== "Uncategorized"
                            ? `Create question in "${selectedTopic}"`
                            : "Create Question"
                    }
                    title="Create"
                    variant="default"
                    icon={<Plus size={16} />}
                />
            </PermissionGate>
        );
    }, [createPage, createUrl, navigate, selectedTopic, table.permission?.keys?.create]);

    const onEdit = useMemo(() => {
        if (!editPage) return undefined;
        return (row: any) => {
            const pathTemplate = normalizeEntityActionPath(entityConfig.path, editPage.path);
            const path = resolveEntityActionPath(pathTemplate, row, entityConfig.schema.idField);
            if (!path) {
                toast.error("Unable to open edit page because row id is missing.");
                return;
            }
            navigate(path);
        };
    }, [editPage, navigate]);

    // Table view: only Edit + Delete (no "view detail" eye)
    const renderTableRowActions = (row: QuestionDTO) => (
        <>
            {onEdit && (
                <PermissionGate permission={table.permission?.keys?.update}>
                    <ActionButton
                        onClick={() => onEdit(row)}
                        tooltip="Edit"
                        icon={<Pencil size={10} className="text-gray-500" />}
                    />
                </PermissionGate>
            )}
            <PermissionGate permission={table.permission?.keys?.delete}>
                <ActionButton
                    onClick={() => setDeleteTarget(row)}
                    tooltip="Delete"
                    icon={<Trash2 size={10} className="text-red-500" />}
                />
            </PermissionGate>
        </>
    );

    const isStudentRole = normalizeRole(activeRole) === STUDENT_ROLE;
    const isReadOnlyLikeRole =
        !!table.permission?.canRead &&
        !table.permission?.canCreate &&
        !table.permission?.canUpdate &&
        !table.permission?.canDelete &&
        !table.permission?.canImport &&
        !table.permission?.canExport;

    const browseMode = isStudentRole || isReadOnlyLikeRole;

    const filteredTopicsList = useMemo(() => {
        if (!topicSearch.trim()) return topics;
        const q = topicSearch.trim().toLowerCase();
        return topics.filter((t) => t.toLowerCase().includes(q));
    }, [topics, topicSearch]);

    return (
        <MainLayout pathName={{ questions: "Questions" }}>
            <div className="flex flex-1 min-h-0 gap-4 h-[calc(100vh-6.5rem)]">

                {/* LEFT SIDEBAR: Full Multi-dimensional Filters */}
                <aside className="w-64 xl:w-72 shrink-0 flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <Layers className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-sm">Filters</span>
                        </div>
                        {hasActiveFilters && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleClearAllFilters}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                                Clear all
                            </Button>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-3 space-y-4">
                        {/* 1. Keyword search */}
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground block">Search Content</label>
                            <div className="relative">
                                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                                <Input
                                    placeholder="Search question text..."
                                    value={keyword}
                                    onChange={(e) => setKeyword(e.target.value)}
                                    className="pl-8 pr-7 h-8 text-xs bg-muted/30 focus-visible:ring-1"
                                />
                                {keyword && (
                                    <button
                                        onClick={() => setKeyword("")}
                                        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 2. Question Type Filter */}
                        <div className="space-y-2 pt-2 border-t">
                            <span className="text-xs font-semibold text-muted-foreground block">Question Type</span>
                            <div className="space-y-1.5 pl-0.5">
                                {(["MULTIPLE_CHOICE", "CODING", "ESSAY"] as QuestionType[]).map((t) => {
                                    const isChecked = selectedTypes.has(t);
                                    const count = typeCounts[t] ?? 0;
                                    return (
                                        <label
                                            key={t}
                                            className="flex items-center justify-between text-xs cursor-pointer hover:text-foreground transition-colors group"
                                        >
                                            <span className="flex items-center gap-2 text-muted-foreground group-hover:text-foreground">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleType(t)}
                                                    className="size-3.5 rounded border-input accent-primary cursor-pointer"
                                                />
                                                <span>{TYPE_LABEL[t]}</span>
                                            </span>
                                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                                                {count}
                                            </Badge>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 3. Difficulty Filter */}
                        <div className="space-y-2 pt-2 border-t">
                            <span className="text-xs font-semibold text-muted-foreground block">Difficulty</span>
                            <div className="space-y-1.5 pl-0.5">
                                {(["EASY", "MEDIUM", "HARD"] as QuestionDifficulty[]).map((d) => {
                                    const isChecked = selectedDifficulties.has(d);
                                    const count = difficultyCounts[d] ?? 0;
                                    const style = DIFFICULTY_STYLE[d];
                                    return (
                                        <label
                                            key={d}
                                            className="flex items-center justify-between text-xs cursor-pointer hover:text-foreground transition-colors group"
                                        >
                                            <span className="flex items-center gap-2">
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={() => toggleDifficulty(d)}
                                                    className="size-3.5 rounded border-input accent-primary cursor-pointer"
                                                />
                                                <span className={`font-medium ${style.text}`}>{DIFFICULTY_LABEL[d]}</span>
                                            </span>
                                            <Badge variant="secondary" className="px-1.5 py-0 text-[10px] font-normal">
                                                {count}
                                            </Badge>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 4. Topics Filter */}
                        <div className="space-y-2 pt-2 border-t">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-semibold text-muted-foreground">Topics</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground"
                                    onClick={() => setIsNewTopicOpen(true)}
                                    title="Add New Topic"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </Button>
                            </div>

                            {/* Topic mini search */}
                            {topics.length > 5 && (
                                <Input
                                    placeholder="Filter topics list..."
                                    value={topicSearch}
                                    onChange={(e) => setTopicSearch(e.target.value)}
                                    className="h-7 text-[11px] bg-muted/20"
                                />
                            )}

                            <div className="space-y-1 pt-1">
                                {/* All Questions row */}
                                <button
                                    type="button"
                                    onClick={() => handleSelectTopic("")}
                                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${!selectedTopic
                                        ? "bg-primary text-primary-foreground shadow-xs"
                                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                        }`}
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <LayoutGrid className="w-3.5 h-3.5 shrink-0" />
                                        <span className="truncate">All Questions</span>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className={`text-[10px] px-1.5 py-0 font-normal ${!selectedTopic ? "bg-primary-foreground/20 text-primary-foreground" : ""
                                            }`}
                                    >
                                        {allQuestions.length}
                                    </Badge>
                                </button>

                                {/* Named Topics */}
                                {isLoadingSummary ? (
                                    <div className="py-3 text-center text-xs text-muted-foreground animate-pulse">Loading topics...</div>
                                ) : (
                                    filteredTopicsList.map((topic) => {
                                        const isSelected = selectedTopic === topic;
                                        const count = topicCounts[topic] ?? 0;
                                        return (
                                            <button
                                                key={topic}
                                                type="button"
                                                onClick={() => handleSelectTopic(topic)}
                                                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors group ${isSelected
                                                    ? "bg-primary/15 text-primary border border-primary/20 shadow-xs dark:bg-primary/20"
                                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                                    }`}
                                            >
                                                <div className="flex items-center gap-2 truncate">
                                                    {isSelected ? (
                                                        <FolderOpen className="w-3.5 h-3.5 shrink-0 text-primary" />
                                                    ) : (
                                                        <Folder className="w-3.5 h-3.5 shrink-0 group-hover:text-foreground" />
                                                    )}
                                                    <span className="truncate capitalize">{topic}</span>
                                                </div>
                                                <Badge
                                                    variant="secondary"
                                                    className={`text-[10px] px-1.5 py-0 font-normal shrink-0 ${isSelected ? "bg-primary/20 text-primary border border-primary/30" : ""
                                                        }`}
                                                >
                                                    {count}
                                                </Badge>
                                            </button>
                                        );
                                    })
                                )}

                                {/* Uncategorized (bottom item) */}
                                {noTopicCount > 0 && !topicSearch && (
                                    <>
                                        <div className="h-px bg-border my-1.5" />
                                        <button
                                            type="button"
                                            onClick={() => handleSelectTopic("Uncategorized")}
                                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors group ${selectedTopic === "Uncategorized"
                                                ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-xs"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                                }`}
                                        >
                                            <div className="flex items-center gap-2 truncate">
                                                <FolderX className={`w-3.5 h-3.5 shrink-0 ${selectedTopic === "Uncategorized" ? "text-amber-600 dark:text-amber-400" : "text-amber-500"}`} />
                                                <span className="truncate">Uncategorized</span>
                                            </div>
                                            <Badge
                                                variant="secondary"
                                                className={`text-[10px] px-1.5 py-0 font-normal shrink-0 ${selectedTopic === "Uncategorized" ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30" : ""
                                                    }`}
                                            >
                                                {noTopicCount}
                                            </Badge>
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Footer */}
                    <div className="p-3 border-t bg-muted/10">
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs justify-center gap-1.5"
                            onClick={() => setIsNewTopicOpen(true)}
                        >
                            <Plus className="w-3.5 h-3.5" />
                            New Topic
                        </Button>
                    </div>
                </aside>

                {/* RIGHT COLUMN: Question Library Workspace */}
                <main className="flex-1 min-w-0 flex flex-col bg-card border rounded-xl p-4 shadow-sm overflow-hidden">

                    {/* Top Action Toolbar */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b">
                        {/* Left: Active Filters indicator */}
                        <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="font-semibold text-foreground">
                                {filteredQuestions.length} {filteredQuestions.length === 1 ? "question" : "questions"}
                            </span>
                            {selectedTopic && (
                                <Badge variant="outline" className="text-xs font-medium capitalize flex items-center gap-1">
                                    <span>Topic: {selectedTopic}</span>
                                    <X className="size-3 cursor-pointer hover:text-foreground" onClick={() => handleSelectTopic("")} />
                                </Badge>
                            )}
                            {Array.from(selectedTypes).map((t) => (
                                <Badge key={t} variant="secondary" className="text-xs font-medium flex items-center gap-1">
                                    <span>{TYPE_LABEL[t]}</span>
                                    <X className="size-3 cursor-pointer hover:text-foreground" onClick={() => toggleType(t)} />
                                </Badge>
                            ))}
                            {Array.from(selectedDifficulties).map((d) => (
                                <Badge key={d} variant="secondary" className="text-xs font-medium flex items-center gap-1">
                                    <span className={DIFFICULTY_STYLE[d].text}>{DIFFICULTY_LABEL[d]}</span>
                                    <X className="size-3 cursor-pointer hover:text-foreground" onClick={() => toggleDifficulty(d)} />
                                </Badge>
                            ))}
                            {keyword && (
                                <Badge variant="outline" className="text-xs font-medium flex items-center gap-1">
                                    <span>Search: "{keyword}"</span>
                                    <X className="size-3 cursor-pointer hover:text-foreground" onClick={() => setKeyword("")} />
                                </Badge>
                            )}
                            {hasActiveFilters && (
                                <button
                                    onClick={handleClearAllFilters}
                                    className="text-xs text-primary hover:underline ml-1"
                                >
                                    Clear all
                                </button>
                            )}
                        </div>

                        {/* Right: View Mode Toggle & Actions */}
                        <div className="flex items-center gap-2">
                            {/* Preview all answers (card view) */}
                            {viewMode === "card" && (
                                <Button
                                    type="button"
                                    variant={allExpanded ? "default" : "outline"}
                                    size="sm"
                                    className="h-8 gap-1.5 text-xs"
                                    onClick={toggleAllPreview}
                                    disabled={filteredQuestions.length === 0}
                                >
                                    {allExpanded ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                                    {allExpanded ? "Hide all answers" : "Preview all"}
                                </Button>
                            )}

                            {/* View Mode Switcher: Card vs Table */}
                            <div className="flex items-center bg-muted/40 p-1 rounded-lg border text-xs font-medium">
                                <button
                                    type="button"
                                    onClick={() => setViewMode("card")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${viewMode === "card"
                                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    title="View as Cards"
                                >
                                    <LayoutGrid className="size-3.5" />
                                    <span>Card</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode("table")}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md transition-all ${viewMode === "table"
                                        ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                                        : "text-muted-foreground hover:text-foreground"
                                        }`}
                                    title="View as Table"
                                >
                                    <TableIcon className="size-3.5" />
                                    <span>Table</span>
                                </button>
                            </div>

                            {!browseMode && headerActions}
                        </div>
                    </div>

                    {/* Main List Area */}
                    <div className="flex-1 min-h-0 flex flex-col pt-3">
                        {viewMode === "card" ? (
                            /* CARD VIEW (Dạng Thẻ tối ưu) */
                            <div className="flex-1 min-h-0 flex flex-col justify-between">
                                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                    {cardPagedData.length === 0 ? (
                                        <div className="py-16 text-center text-sm text-muted-foreground">
                                            No questions match the selected filters.
                                        </div>
                                    ) : (
                                        cardPagedData.map((q) => {
                                            const isExpanded = expandedIds.has(q.id);
                                            const diffStyle = DIFFICULTY_STYLE[q.difficulty] ?? DIFFICULTY_STYLE.MEDIUM;

                                            return (
                                                <div
                                                    key={q.id}
                                                    className="rounded-xl border bg-card p-4 hover:border-border/80 transition-all shadow-xs space-y-3"
                                                >
                                                    {/* Top Header Row */}
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex flex-wrap items-center gap-1.5">
                                                            <Badge variant="outline" className="text-xs font-medium">
                                                                {TYPE_LABEL[q.type] ?? q.type}
                                                            </Badge>
                                                            <span
                                                                className={`px-2 py-0.5 rounded text-xs font-semibold border ${diffStyle.text} ${diffStyle.bg} ${diffStyle.border}`}
                                                            >
                                                                {DIFFICULTY_LABEL[q.difficulty] ?? q.difficulty}
                                                            </span>
                                                            <span className="text-xs text-muted-foreground font-medium">
                                                                Points: {q.points ?? 1}
                                                            </span>
                                                            {q.topic ? (
                                                                <Badge variant="secondary" className="text-xs font-mono">
                                                                    #{q.topic}
                                                                </Badge>
                                                            ) : (
                                                                <Badge variant="outline" className="text-xs font-mono text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/10">
                                                                    #Uncategorized
                                                                </Badge>
                                                            )}

                                                            {/* Status Switch */}
                                                            <div className="flex items-center gap-1.5 ml-2">
                                                                <Switch
                                                                    checked={Boolean(q.isActive ?? true)}
                                                                    onCheckedChange={() => handleToggleStatus(q.id, q.isActive ?? true)}
                                                                    aria-label="Toggle active status"
                                                                />
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {q.isActive ?? true ? "Active" : "Inactive"}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* Action Buttons */}
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                className="h-7 px-2 text-xs text-primary gap-1"
                                                                onClick={() => togglePreview(q.id)}
                                                            >
                                                                <Eye className="size-3.5" />
                                                                {isExpanded ? "Hide answers" : "Preview"}
                                                            </Button>

                                                            {!browseMode && onEdit && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                                                                    title="Edit Question"
                                                                    onClick={() => onEdit(q)}
                                                                >
                                                                    <Pencil className="size-3.5" />
                                                                </Button>
                                                            )}
                                                            {!browseMode && (
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                                                    title="Delete Question"
                                                                    onClick={() => setDeleteTarget(q)}
                                                                >
                                                                    <Trash2 className="size-3.5" />
                                                                </Button>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Question Content */}
                                                    <p className="text-sm font-medium text-foreground whitespace-pre-wrap break-words leading-relaxed">
                                                        {q.content}
                                                    </p>

                                                    {/* Expandable Answers / Preview Section */}
                                                    {isExpanded && (
                                                        <div className="pt-2 border-t">
                                                            <QuestionAnswersPreview question={q} />
                                                        </div>
                                                    )}

                                                    {/* Metadata Footer: Created At & Updated At */}
                                                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px] text-muted-foreground">
                                                        <div className="flex flex-wrap items-center gap-4">
                                                            <span className="flex items-center gap-1.5">
                                                                <Calendar className="size-3 text-muted-foreground/70" />
                                                                Created At: <strong className="font-normal text-foreground/80">{formatDateTime(q.createdAt)}</strong>
                                                            </span>
                                                            <span className="flex items-center gap-1.5">
                                                                <Clock className="size-3 text-muted-foreground/70" />
                                                                Updated At: <strong className="font-normal text-foreground/80">{formatDateTime(q.updatedAt || q.createdAt)}</strong>
                                                            </span>
                                                        </div>
                                                        <span className="text-[10px] text-muted-foreground/60 font-mono">
                                                            ID: #{q.id}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                {/* Card View Pagination */}
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 mt-2 border-t text-xs text-muted-foreground">
                                    <div className="flex items-center gap-2">
                                        <span>Rows per page</span>
                                        <Select
                                            value={String(cardPageSize)}
                                            onValueChange={(val) => {
                                                setCardPageSize(Number(val));
                                                setCardPage(0);
                                            }}
                                        >
                                            <SelectTrigger className="h-8 w-[72px]">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="5">5</SelectItem>
                                                <SelectItem value="10">10</SelectItem>
                                                <SelectItem value="20">20</SelectItem>
                                                <SelectItem value="50">50</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <span className="ml-2">
                                            Page <strong className="text-foreground">{cardPage + 1}</strong> of <strong className="text-foreground">{cardTotalPages}</strong>
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-1">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-2.5 text-xs"
                                            disabled={cardPage === 0}
                                            onClick={() => setCardPage((p) => Math.max(0, p - 1))}
                                        >
                                            Previous
                                        </Button>
                                        <div className="px-2 font-medium">
                                            {cardPage + 1} / {cardTotalPages}
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 px-2.5 text-xs"
                                            disabled={cardPage + 1 >= cardTotalPages}
                                            onClick={() => setCardPage((p) => p + 1)}
                                        >
                                            Next
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            /* TABLE VIEW (Dạng Bảng ProTable) */
                            <div className="flex-1 min-h-0 flex flex-col">
                                <ProTable
                                    table={effectiveTable}
                                    mode={browseMode ? "browse" : "default"}
                                    headerActions={browseMode ? undefined : headerActions}
                                    hideActions={browseMode}
                                    onEdit={browseMode ? undefined : onEdit}
                                    renderRowActions={browseMode ? undefined : renderTableRowActions}
                                    renderCard={entityConfig.cardRenderer}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>

            {/* Dialog: Create Question with New Topic */}
            <Dialog open={isNewTopicOpen} onOpenChange={setIsNewTopicOpen}>
                <DialogContent className="sm:max-w-[420px]">
                    <DialogHeader>
                        <DialogTitle>Add New Topic</DialogTitle>
                        <DialogDescription>
                            Enter a new topic name. You will then be taken to the create question form with this topic pre-selected.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-3">
                        <label className="text-xs font-medium text-muted-foreground block mb-1.5">
                            Topic Name
                        </label>
                        <Input
                            placeholder="e.g. Microservices, React Hooks, Docker"
                            value={newTopicName}
                            onChange={(e) => setNewTopicName(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleCreateWithNewTopic();
                                }
                            }}
                            autoFocus
                        />
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsNewTopicOpen(false)}>
                            Cancel
                        </Button>
                        <Button onClick={handleCreateWithNewTopic}>
                            Continue to Create
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Dialog: Confirm Delete Question */}
            <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle>Delete Question</DialogTitle>
                        <DialogDescription>
                            Are you sure you want to delete this question? This action cannot be undone.
                        </DialogDescription>
                    </DialogHeader>

                    {deleteTarget && (
                        <div className="p-3 my-2 rounded-lg bg-muted/30 border text-xs text-muted-foreground line-clamp-3">
                            "{deleteTarget.content}"
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDeleteTarget(null)}>
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteConfirm}
                            disabled={isDeleting}
                        >
                            {isDeleting ? "Deleting..." : "Delete Permanently"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </MainLayout>
    );
}
