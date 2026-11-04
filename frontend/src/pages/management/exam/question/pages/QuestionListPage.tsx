import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Folder,
    FolderOpen,
    Filter,
    FolderX,
    Layers,
    LayoutGrid,
    Plus,
    Search,
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

export default function QuestionListPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { activeRole } = usePermissions();

    const initialTopic = searchParams.get("topic") || "";
    const [selectedTopic, setSelectedTopic] = useState<string>(initialTopic);
    const [topicSearch, setTopicSearch] = useState("");
    const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);
    const [newTopicName, setNewTopicName] = useState("");

    const { data: allQuestionsData, isLoading: isLoadingTopics } = useQuery({
        queryKey: ["question", "topics-summary"],
        queryFn: () => questionApi.getPage({ page: 0, size: 2000, sort: "id,desc" }),
        staleTime: 15_000,
    });

    const { topics, topicCounts, totalCount } = useMemo(() => {
        const list = allQuestionsData?.content || [];
        const counts: Record<string, number> = {};

        for (const item of list) {
            const rawTopic = (item.topic || "").trim();
            const topicKey = rawTopic || "(No Topic)";
            counts[topicKey] = (counts[topicKey] || 0) + 1;
        }

        const sorted = Object.keys(counts)
            .filter((t) => t !== "(No Topic)")
            .sort((a, b) => a.localeCompare(b));

        if (counts["(No Topic)"]) {
            sorted.push("(No Topic)");
        }

        return {
            topics: sorted,
            topicCounts: counts,
            totalCount: allQuestionsData?.totalElements ?? list.length,
        };
    }, [allQuestionsData]);

    const dynamicSchema = useMemo(() => {
        const topicOptions = topics
            .filter((t) => t && t !== "(No Topic)")
            .map((t) => ({ label: t, value: t }));

        return {
            ...entityConfig.schema,
            fields: entityConfig.schema.fields.map((f) => {
                if (f.name === "topic") {
                    return {
                        ...f,
                        options: topicOptions,
                        filterOptions: topicOptions,
                    };
                }
                return f;
            }),
        };
    }, [topics]);

    const table = useProTable(entityConfig.api, dynamicSchema);

    useEffect(() => {
        if (initialTopic) {
            table.setFilters((prev: any) => ({ ...prev, topic: initialTopic }));
            setSelectedTopic(initialTopic);
        }
    }, []);

    useEffect(() => {
        const filterTopic = table.filters?.topic;
        const current = Array.isArray(filterTopic)
            ? (filterTopic[0] || "")
            : (filterTopic || "");
        if (current !== selectedTopic) {
            setSelectedTopic(current);
            const newParams = new URLSearchParams(searchParams);
            if (current) {
                newParams.set("topic", current);
            } else {
                newParams.delete("topic");
            }
            setSearchParams(newParams, { replace: true });
        }
    }, [table.filters?.topic]);

    const filteredTopics = useMemo(() => {
        if (!topicSearch.trim()) return topics;
        const q = topicSearch.trim().toLowerCase();
        return topics.filter((t) => t.toLowerCase().includes(q));
    }, [topics, topicSearch]);

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

        table.setFilters((prev: any) => {
            const updated = { ...prev };
            if (newTopic) {
                updated.topic = newTopic === "(No Topic)" ? "" : newTopic;
            } else {
                delete updated.topic;
            }
            return updated;
        });
        table.setPage(0);
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

    const createPage = entityConfig.actionPages?.create;
    const editPage = entityConfig.actionPages?.edit;
    const detailPage = entityConfig.actionPages?.detail;

    const createUrl = useMemo(() => {
        if (!createPage) return "";
        const base = normalizeEntityActionPath(entityConfig.path, createPage.path);
        return selectedTopic && selectedTopic !== "(No Topic)"
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
                        selectedTopic && selectedTopic !== "(No Topic)"
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

    const onView = useMemo(() => {
        if (!detailPage) return undefined;

        return (row: any) => {
            const pathTemplate = normalizeEntityActionPath(entityConfig.path, detailPage.path);
            const path = resolveEntityActionPath(pathTemplate, row, entityConfig.schema.idField);
            if (!path) {
                toast.error("Unable to open detail page because row id is missing.");
                return;
            }
            navigate(path);
        };
    }, [detailPage, navigate]);

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

    const filterSummary = (
        <>

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
                {(createdFrom || createdTo) && (
                    <Badge variant="outline" className="text-xs font-medium flex items-center gap-1">
                        <span>Created: {createdFrom || "…"} → {createdTo || "…"}</span>
                        <X className="size-3 cursor-pointer hover:text-foreground" onClick={() => { setCreatedFrom(""); setCreatedTo(""); }} />
                    </Badge>
                )}
                {(updatedFrom || updatedTo) && (
                    <Badge variant="outline" className="text-xs font-medium flex items-center gap-1">
                        <span>Updated: {updatedFrom || "…"} → {updatedTo || "…"}</span>
                        <X className="size-3 cursor-pointer hover:text-foreground" onClick={() => { setUpdatedFrom(""); setUpdatedTo(""); }} />
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

        </>
    );

    const previewAllButton = (
        <>


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

        </>
    );

    const viewSwitcher = (
        <>
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

        </>
    );

    return (
        <MainLayout pathName={{ questions: "Questions" }}>
            <div className="flex flex-1 min-h-0 gap-4 h-[calc(100vh-6.5rem)]">
                <aside className="w-64 xl:w-72 shrink-0 flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm">
                    <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/20">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                                <Layers className="w-4 h-4" />
                            </div>
                            <span className="font-semibold text-sm">Topics</span>
                            <Badge variant="secondary" className="px-1.5 py-0 text-xs font-medium">
                                {topics.length}
                            </Badge>
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={() => setIsNewTopicOpen(true)}
                            title="New Topic"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>
                    </div>

                    <div className="p-3 pb-2">
                        <div className="relative">
                            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                            <Input
                                placeholder="Filter topics..."
                                value={topicSearch}
                                onChange={(e) => setTopicSearch(e.target.value)}
                                className="pl-8 pr-7 h-8 text-xs bg-muted/30 focus-visible:ring-1"
                            />
                            {topicSearch && (
                                <button
                                    onClick={() => setTopicSearch("")}
                                    className="absolute right-2 top-2 text-muted-foreground hover:text-foreground"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
                        <button
                            type="button"
                            onClick={() => handleSelectTopic("")}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                                !selectedTopic
                                    ? "bg-primary text-primary-foreground shadow-sm"
                                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                            }`}
                        >
                            <div className="flex items-center gap-2 truncate">
                                <LayoutGrid className="w-4 h-4 shrink-0" />
                                <span className="truncate">All Questions</span>
                            </div>
                            <Badge
                                variant="secondary"
                                className={`text-[11px] px-1.5 py-0 font-normal ${
                                    !selectedTopic ? "bg-primary-foreground/20 text-primary-foreground" : ""
                                }`}
                            >
                                {totalCount}
                            </Badge>
                        </button>

                        <div className="h-px bg-border my-1.5 mx-1" />

                        {isLoadingTopics ? (
                            <div className="py-6 text-center text-xs text-muted-foreground animate-pulse">
                                Loading topics...
                            </div>
                        ) : filteredTopics.length > 0 ? (
                            filteredTopics.map((topic) => {
                                const isSelected = selectedTopic === topic;
                                const count = topicCounts[topic] ?? 0;

                                return (
                                    <button
                                        key={topic}
                                        type="button"
                                        onClick={() => handleSelectTopic(topic)}
                                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors group ${
                                            isSelected
                                                ? "bg-primary/15 text-primary border border-primary/20 shadow-xs dark:bg-primary/20"
                                                : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {isSelected ? (
                                                <FolderOpen className="w-4 h-4 shrink-0 text-primary" />
                                            ) : (
                                                <Folder className="w-4 h-4 shrink-0 group-hover:text-foreground" />
                                            )}
                                            <span className="truncate capitalize">{topic}</span>
                                        </div>
                                        <Badge
                                            variant="secondary"
                                            className={`text-[11px] px-1.5 py-0 font-normal shrink-0 ${
                                                isSelected ? "bg-primary/20 text-primary border border-primary/30" : ""
                                            }`}
                                        >
                                            {count}
                                        </Badge>
                                    </button>
                                );
                            })
                        ) : (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                                No topics match "{topicSearch}"
                            </div>
                        )}
                    </div>

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

                <main className="flex-1 min-w-0 flex flex-col bg-card border rounded-xl p-4 shadow-sm overflow-hidden">

                    {/* Single top bar shared by Card and Table view (same position in both) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b min-h-[3.25rem]">
                        <div className="flex flex-wrap items-center gap-3">
                            {viewSwitcher}
                            {filterSummary}
                        </div>

                        <div className="flex items-center gap-2">
                            {viewMode === "card" && previewAllButton}
                            {!browseMode && <ToolbarActions table={effectiveTable} headerActions={headerActions} />}
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
                                            const isActive = Boolean(q.isActive ?? true);
                                            const dimClass = isActive ? "" : "opacity-50 hover:opacity-100 transition-opacity";
                                            const diffStyle = DIFFICULTY_STYLE[q.difficulty] ?? DIFFICULTY_STYLE.MEDIUM;

                                            return (
                                                <div
                                                    key={q.id}
                                                    id={`question-card-${q.id}`}
                                                    className={`rounded-xl border p-4 hover:border-border/80 transition-all shadow-xs space-y-3 ${isActive ? "bg-card" : "bg-muted/20 border-dashed"
                                                        }`}
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
                                                    <p className={`text-sm font-medium text-foreground whitespace-pre-wrap break-words leading-relaxed ${dimClass}`}>
                                                        {q.content}
                                                    </p>

                                                    {/* Expandable Answers / Preview Section */}
                                                    {isExpanded && (
                                                        <div className={`pt-2 border-t ${dimClass}`}>
                                                            <QuestionAnswersPreview question={q} />
                                                            <div className="flex justify-center pt-2">
                                                                <Button
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    className="h-7 gap-1 text-xs text-muted-foreground hover:text-foreground"
                                                                    onClick={() => {
                                                                        togglePreview(q.id);
                                                                        requestAnimationFrame(() =>
                                                                            document
                                                                                .getElementById(`question-card-${q.id}`)
                                                                                ?.scrollIntoView({ block: "nearest", behavior: "smooth" })
                                                                        );
                                                                    }}
                                                                >
                                                                    <ChevronUp className="size-3.5" />
                                                                    Collapse
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Metadata Footer: Created At & Updated At */}
                                                    <div className={`flex flex-wrap items-center justify-between gap-2 pt-2 border-t text-[11px] text-muted-foreground ${dimClass}`}>
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
                                    hideToolbar
                                    onEdit={browseMode ? undefined : onEdit}
                                    renderRowActions={browseMode ? undefined : renderTableRowActions}
                                    renderCard={entityConfig.cardRenderer}
                                />
                            </div>
                        )}
                    </div>
                </main>
            </div>

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
        </MainLayout>
    );
}
