import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Folder,
    FolderOpen,
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
    const [uncatPage, setUncatPage] = useState(0);
    const [topicSearch, setTopicSearch] = useState("");
    const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);
    const [newTopicName, setNewTopicName] = useState("");

    // Fetch questions summary to build topics list with counts
    const { data: allQuestionsData, isLoading: isLoadingTopics, refetch: refetchTopics } = useQuery({
        queryKey: ["question", "topics-summary"],
        queryFn: () => questionApi.getPage({ page: 0, size: 2000, sort: "id,desc" }),
        staleTime: 15_000,
    });

    const { topics, topicCounts, totalCount, noTopicQuestions } = useMemo(() => {
        const list = allQuestionsData?.content || [];
        const counts: Record<string, number> = {};
        const noTopicList: typeof list = [];

        for (const item of list) {
            const rawTopic = (item.topic || "").trim();
            if (!rawTopic) {
                noTopicList.push(item);
                counts["Uncategorized"] = (counts["Uncategorized"] || 0) + 1;
            } else {
                counts[rawTopic] = (counts[rawTopic] || 0) + 1;
            }
        }

        const sorted = Object.keys(counts)
            .filter((t) => t && t !== "Uncategorized")
            .sort((a, b) => a.localeCompare(b));

        return {
            topics: sorted,
            topicCounts: counts,
            totalCount: allQuestionsData?.totalElements ?? list.length,
            noTopicQuestions: noTopicList,
        };
    }, [allQuestionsData]);

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

    // Synchronize initial topic from URL to table filter once
    useEffect(() => {
        if (initialTopic) {
            setSelectedTopic(initialTopic);
            if (initialTopic !== "Uncategorized") {
                table.setFilters((prev: any) => ({ ...prev, topic: initialTopic }));
            }
        }
    }, []);

    const isUncategorized = selectedTopic === "Uncategorized";

    const filteredTopics = useMemo(() => {
        if (!topicSearch.trim()) return topics;
        const q = topicSearch.trim().toLowerCase();
        return topics.filter((t) => t.toLowerCase().includes(q));
    }, [topics, topicSearch]);

    const handleSelectTopic = (topic: string) => {
        const newTopic = selectedTopic === topic ? "" : topic;
        setSelectedTopic(newTopic);
        setUncatPage(0);

        const newParams = new URLSearchParams(searchParams);
        if (newTopic) {
            newParams.set("topic", newTopic);
        } else {
            newParams.delete("topic");
        }
        setSearchParams(newParams, { replace: true });

        if (newTopic === "Uncategorized") {
            table.setFilters((prev: any) => {
                const updated = { ...prev };
                delete updated.topic;
                return updated;
            });
        } else {
            table.setFilters((prev: any) => {
                const updated = { ...prev };
                if (newTopic) {
                    updated.topic = newTopic;
                } else {
                    delete updated.topic;
                }
                return updated;
            });
        }
        table.setPage(0);
    };

    // Construct uncategorizedTable to preserve full ProTable feature parity and UI styling
    const uncategorizedTable = useMemo(() => {
        let list = noTopicQuestions;
        if (table.search?.trim()) {
            const s = table.search.toLowerCase();
            list = list.filter((q: any) =>
                (q.content || "").toLowerCase().includes(s) ||
                (q.type || "").toLowerCase().includes(s) ||
                (q.difficulty || "").toLowerCase().includes(s)
            );
        }
        if (table.sortState && table.sortState.length > 0) {
            const { field, order } = table.sortState[0];
            list = [...list].sort((a: any, b: any) => {
                const valA = a[field] ?? "";
                const valB = b[field] ?? "";
                if (valA < valB) return order === "asc" ? -1 : 1;
                if (valA > valB) return order === "asc" ? 1 : -1;
                return 0;
            });
        }
        const total = list.length;
        const size = table.size || 10;
        const maxPage = Math.max(0, Math.ceil(total / size) - 1);
        const page = Math.min(uncatPage, maxPage);
        const start = page * size;
        const paged = list.slice(start, start + size);

        return {
            ...table,
            data: paged,
            total,
            page,
            setPage: (p: number) => setUncatPage(p),
            setSize: (s: number) => {
                table.setSize(s);
                setUncatPage(0);
            },
            loading: isLoadingTopics,
            isFetching: isLoadingTopics,
            refetch: async () => {
                await Promise.all([table.refetch?.(), refetchTopics?.()]);
            },
        };
    }, [table, noTopicQuestions, uncatPage, isLoadingTopics, refetchTopics]);

    const effectiveTable = isUncategorized ? uncategorizedTable : table;

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

    // Table routing & actions
    const createPage = entityConfig.actionPages?.create;
    const editPage = entityConfig.actionPages?.edit;
    const detailPage = entityConfig.actionPages?.detail;

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

    return (
        <MainLayout pathName={{ questions: "Questions" }}>
            <div className="flex flex-1 min-h-0 gap-4 h-[calc(100vh-6.5rem)]">
                {/* Left Column: Topics Sidebar */}
                <aside className="w-64 xl:w-72 shrink-0 flex flex-col bg-card border rounded-xl overflow-hidden shadow-sm">
                    {/* Header */}
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

                    {/* Search Topic */}
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

                    {/* Topics List */}
                    <div className="flex-1 overflow-y-auto px-2 space-y-1 py-1">
                        {/* All Questions Button */}
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

                        {/* Distinct Topics */}
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
                        ) : topicSearch ? (
                            <div className="py-6 text-center text-xs text-muted-foreground">
                                No topics match "{topicSearch}"
                            </div>
                        ) : null}

                        {/* Uncategorized Item (Always available at bottom if questions without topic exist) */}
                        {!topicSearch && noTopicQuestions.length > 0 && (
                            <>
                                <div className="h-px bg-border my-1.5 mx-1" />
                                <button
                                    type="button"
                                    onClick={() => handleSelectTopic("Uncategorized")}
                                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors group ${
                                        isUncategorized
                                            ? "bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 shadow-xs"
                                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                                    }`}
                                    title="Questions without a topic"
                                >
                                    <div className="flex items-center gap-2 truncate">
                                        <FolderX className={`w-4 h-4 shrink-0 ${isUncategorized ? "text-amber-600 dark:text-amber-400" : "text-amber-500"}`} />
                                        <span className="truncate">Uncategorized</span>
                                    </div>
                                    <Badge
                                        variant="secondary"
                                        className={`text-[11px] px-1.5 py-0 font-normal shrink-0 ${
                                            isUncategorized
                                                ? "bg-amber-500/20 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                                : ""
                                        }`}
                                    >
                                        {noTopicQuestions.length}
                                    </Badge>
                                </button>
                            </>
                        )}
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

                {/* Right Column: Question Table */}
                <main className="flex-1 min-w-0 flex flex-col bg-card border rounded-xl p-4 shadow-sm overflow-hidden">
                    {/* Active Filter Pill Bar */}
                    {selectedTopic && (
                        <div className={`flex items-center justify-between px-3 py-2 mb-3 rounded-lg text-xs border ${
                            isUncategorized
                                ? "bg-amber-500/10 border-amber-500/20"
                                : "bg-primary/10 border-primary/20"
                        }`}>
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Filtered by topic:</span>
                                <Badge variant={isUncategorized ? "outline" : "default"} className={`text-xs font-semibold capitalize ${
                                    isUncategorized ? "border-amber-500/40 text-amber-700 dark:text-amber-400 bg-amber-500/15" : ""
                                }`}>
                                    {selectedTopic}
                                </Badge>
                                <span className="text-muted-foreground">
                                    ({effectiveTable.total} {effectiveTable.total === 1 ? "question" : "questions"})
                                </span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleSelectTopic("")}
                                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                            >
                                <X className="w-3 h-3 mr-1" />
                                Clear filter
                            </Button>
                        </div>
                    )}

                    <div className="flex-1 min-h-0 flex flex-col">
                        <ProTable
                            table={effectiveTable}
                            mode={browseMode ? "browse" : "default"}
                            headerActions={browseMode ? undefined : headerActions}
                            hideActions={browseMode}
                            onEdit={browseMode ? undefined : onEdit}
                            onView={onView}
                            renderCard={entityConfig.cardRenderer}
                        />
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
        </MainLayout>
    );
}
