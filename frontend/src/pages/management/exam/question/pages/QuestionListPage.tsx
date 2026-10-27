import { useMemo, useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
    Folder,
    FolderOpen,
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
    const [topicSearch, setTopicSearch] = useState("");
    const [isNewTopicOpen, setIsNewTopicOpen] = useState(false);
    const [newTopicName, setNewTopicName] = useState("");

    const table = useProTable(entityConfig.api, entityConfig.schema);

    useEffect(() => {
        if (initialTopic) {
            table.setFilters((prev: any) => ({ ...prev, topic: initialTopic }));
            setSelectedTopic(initialTopic);
        }
    }, []);

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
                    {selectedTopic && (
                        <div className="flex items-center justify-between px-3 py-2 mb-3 rounded-lg bg-primary/10 border border-primary/20 text-xs">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Filtered by topic:</span>
                                <Badge variant="default" className="text-xs font-semibold capitalize">
                                    {selectedTopic}
                                </Badge>
                                <span className="text-muted-foreground">
                                    ({table.total} {table.total === 1 ? "question" : "questions"})
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
                            table={table}
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
