import { useEffect, useState } from "react";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { useTopicList, useTopicMutations } from "@/hooks/useTopics";
import type { TopicItem } from "@/types/features/content";
import { describeApiError } from "@/utils/api-error.utils";
import { SyllabusImportDialog } from "./SyllabusImportDialog";
import { TopicSyllabusEditorDialog } from "./TopicSyllabusEditorDialog";
import { TopicCloneDialog } from "./TopicCloneDialog";
import { TopicDeleteDialog } from "./TopicDeleteDialog";
import { TopicDetailModal } from "./TopicDetailModal";
import { TopicExportDialog } from "./TopicExportDialog";
import { TopicFormDialog } from "./TopicFormDialog";
import { TopicImportDialog } from "./TopicImportDialog";
import { TopicTable } from "./TopicTable";
import { TopicToolbar } from "./TopicToolbar";

const PAGE_SIZE = 10;

interface TopicListProps {
  onViewDetail?: (topic: TopicItem) => void;
}

export function TopicList({ onViewDetail }: TopicListProps = {}) {
  const { canAccessResource } = usePermissions();
  const canCreate = canAccessResource("SUBJECT", "CREATE");
  const canUpdate = canAccessResource("SUBJECT", "UPDATE");
  const canDelete = canAccessResource("SUBJECT", "DELETE");

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [technicalGroup, setTechnicalGroup] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [page, setPage] = useState(0);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<TopicItem | null>(null);
  const [cloningTopic, setCloningTopic] = useState<TopicItem | null>(null);
  const [deleteTargetTopic, setDeleteTargetTopic] = useState<TopicItem | null>(null);
  const [detailTopic, setDetailTopic] = useState<TopicItem | null>(null);
  const [outlineEditorTopic, setOutlineEditorTopic] = useState<TopicItem | null>(null);
  const [syllabusTargetTopic, setSyllabusTargetTopic] = useState<TopicItem | null>(null);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isSyllabusImportOpen, setIsSyllabusImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput);
      setPage(0);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isLoading, isFetching, isError, error, refetch } = useTopicList({
    page,
    size: PAGE_SIZE,
    search: debouncedSearch.trim() || undefined,
    technicalGroup: technicalGroup !== "ALL" ? technicalGroup : undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
  });

  const { toggleTopicStatus, invalidateTopics } = useTopicMutations();

  const topics = data?.content ?? [];
  const totalPages = data?.totalPages || 1;
  const totalElements = data?.totalElements ?? 0;

  const handleTechnicalGroupChange = (value: string) => {
    setTechnicalGroup(value);
    setPage(0);
  };

  const handleStatusFilterChange = (value: string) => {
    setStatusFilter(value);
    setPage(0);
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setTechnicalGroup("ALL");
    setStatusFilter("ALL");
    setPage(0);
  };

  const handleOpenDetail = (topic: TopicItem) => {
    if (onViewDetail) {
      onViewDetail(topic);
      return;
    }
    setDetailTopic(topic);
  };

  const handleOpenCreate = () => {
    setEditingTopic(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (topic: TopicItem) => {
    setEditingTopic(topic);
    setIsFormOpen(true);
  };

  const handleToggleStatus = async (topic: TopicItem) => {
    const isCurrentlyActive = topic.isActive ?? topic.status === "ACTIVE";
    const nextActive = !isCurrentlyActive;
    try {
      await toggleTopicStatus.mutateAsync({ id: topic.id, active: nextActive });
      toast.success(`Topic ${nextActive ? "activated" : "deactivated"} successfully`);
    } catch (err) {
      toast.error(describeApiError(err, "Failed to change topic status").message);
    }
  };

  return (
    <div className="space-y-4">
      <TopicToolbar
        totalElements={totalElements}
        search={searchInput}
        onSearchChange={setSearchInput}
        technicalGroup={technicalGroup}
        onTechnicalGroupChange={handleTechnicalGroupChange}
        statusFilter={statusFilter}
        onStatusFilterChange={handleStatusFilterChange}
        showFilterPanel={showFilterPanel}
        onToggleFilterPanel={() => setShowFilterPanel((prev) => !prev)}
        onResetFilters={handleResetFilters}
        canCreate={canCreate}
        onOpenImport={() => setIsImportOpen(true)}
        onOpenExport={() => setIsExportOpen(true)}
        onOpenCreate={handleOpenCreate}
      />

      {isError && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 shrink-0 text-red-600" />
            <span>{describeApiError(error, "Failed to load topics").message}</span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            className="h-7 text-xs bg-white border-red-200 text-red-700 hover:bg-red-100"
          >
            Retry
          </Button>
        </div>
      )}

      <TopicTable
        topics={topics}
        loading={isLoading || isFetching}
        page={page}
        pageSize={PAGE_SIZE}
        totalPages={totalPages}
        totalElements={totalElements}
        onPageChange={setPage}
        canCreate={canCreate}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onOpenDetail={handleOpenDetail}
        onOpenOutlineEditor={(topic) => setOutlineEditorTopic(topic)}
        onOpenSyllabusImport={(topic) => {
          setSyllabusTargetTopic(topic);
          setIsSyllabusImportOpen(true);
        }}
        onOpenEdit={handleOpenEdit}
        onOpenClone={(topic) => setCloningTopic(topic)}
        onToggleStatus={(topic) => void handleToggleStatus(topic)}
        onRequestDelete={(topic) => setDeleteTargetTopic(topic)}
      />

      <TopicDetailModal
        topic={detailTopic}
        open={Boolean(detailTopic)}
        onOpenChange={(open) => {
          if (!open) setDetailTopic(null);
        }}
        onEdit={handleOpenEdit}
      />

      <TopicFormDialog
        open={isFormOpen}
        onOpenChange={(open) => {
          setIsFormOpen(open);
          if (!open) setEditingTopic(null);
        }}
        editingTopic={editingTopic}
        onConfigureOutline={(topic) => setOutlineEditorTopic(topic)}
      />

      <TopicCloneDialog
        topic={cloningTopic}
        open={Boolean(cloningTopic)}
        onOpenChange={(open) => {
          if (!open) setCloningTopic(null);
        }}
      />

      <TopicDeleteDialog
        topic={deleteTargetTopic}
        onClose={() => setDeleteTargetTopic(null)}
      />

      <TopicImportDialog
        open={isImportOpen}
        onOpenChange={setIsImportOpen}
      />

      <SyllabusImportDialog
        targetTopic={syllabusTargetTopic}
        open={isSyllabusImportOpen}
        onOpenChange={(open) => {
          setIsSyllabusImportOpen(open);
          if (!open) setSyllabusTargetTopic(null);
        }}
        onSuccess={() => void invalidateTopics()}
      />

      <TopicExportDialog
        open={isExportOpen}
        onOpenChange={setIsExportOpen}
      />

      {outlineEditorTopic && (
        <TopicSyllabusEditorDialog
          topic={outlineEditorTopic}
          open={Boolean(outlineEditorTopic)}
          onOpenChange={(open) => {
            if (!open) setOutlineEditorTopic(null);
          }}
          onSaved={() => void invalidateTopics()}
        />
      )}
    </div>
  );
}
