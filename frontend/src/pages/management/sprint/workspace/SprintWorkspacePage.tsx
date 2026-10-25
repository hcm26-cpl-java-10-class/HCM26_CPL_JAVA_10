import { sprintApi } from "@/api";
import Loading from "@/components/datatable/common/Loading";
import { ConfirmDeleteModal } from "@/components/datatable/modal/ConfirmDeleteModal";
import { FormModal } from "@/components/datatable/modal/form/FormModal";
import { MainLayout } from "@/components/layout/MainLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { SprintDTO, SprintStatus } from "@/types";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layers, Plus, RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  extractErrorMessage,
  useSprintPlanningBoard,
} from "../hooks/useSprintPlanningBoard";
import { sprintSchema } from "../sprint.schema";
import { SprintBacklogBoard } from "./SprintBacklogBoard";
import { SprintWorkspaceHeader } from "./SprintWorkspaceHeader";
import { OverviewTab } from "./OverviewTab";
import {
  emptySprintBacklogMessage,
  incompleteSprintMessage,
  unfinishedSprintItems,
} from "./board.constants";

const SPRINTS_QUERY_KEY = ["sprints", "workspace"] as const;

/** `datetime-local` inputs need `yyyy-MM-ddTHH:mm`, the API returns ISO strings. */
const toDateTimeLocal = (value?: string | null) => {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
};

const TAB_ITEMS = [
  { value: "overview", label: "Overview" },
  { value: "backlog", label: "Sprints & Backlog" },
] as const;

/**
 * `/sprints` workspace (UFR-PRJ-003).
 * <p>
 * Project style header + sprint ribbon + the sprint / product backlog board.
 * The board itself is the Sprint Planning board (UFR-PRJ-003-03): every scope
 * change stays local until "Confirm assignment" persists it atomically.
 */
export default function SprintWorkspacePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasAllPermissions } = usePermissions();

  const canCreate = hasAllPermissions(["SPRINT_CREATE"]);
  const canUpdate = hasAllPermissions(["SPRINT_UPDATE"]);
  const canDelete = hasAllPermissions(["SPRINT_DELETE"]);
  const canEditBoard = canUpdate && hasAllPermissions(["SPRINT_BACKLOG_UPDATE"]);

  const [activeTab, setActiveTab] = useState<string>("backlog");
  const [selectedSprintId, setSelectedSprintId] = useState<number | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);

  const sprintsQuery = useQuery({
    queryKey: SPRINTS_QUERY_KEY,
    queryFn: () =>
      sprintApi.getPage({ page: 0, size: 100, sort: ["id,asc"] }),
  });

  const sprints = useMemo<SprintDTO[]>(
    () => sprintsQuery.data?.content ?? [],
    [sprintsQuery.data],
  );

  /** Default to the sprint that is running right now. */
  useEffect(() => {
    if (sprints.length === 0) return;
    if (selectedSprintId && sprints.some((item) => item.id === selectedSprintId)) {
      return;
    }

    const preferred =
      sprints.find((item) => item.status === "ACTIVE") ??
      sprints.find((item) => item.status === "PLANNED") ??
      sprints[sprints.length - 1];

    setSelectedSprintId(preferred?.id ?? null);
  }, [selectedSprintId, sprints]);

  const selectedSprint =
    sprints.find((item) => item.id === selectedSprintId) ?? null;

  const board = useSprintPlanningBoard({
    sprintId:
      selectedSprintId !== null ? String(selectedSprintId) : undefined,
    canEdit: canEditBoard,
  });

  const tabCounts: Record<string, number> = {
    backlog: board.sprintItems.length,
  };
  const projectLabel =
    board.plan?.projectId != null
      ? `PRJ-${board.plan.projectId}`
      : "SPRINT BOARD";

  const refreshSprints = async () => {
    await queryClient.invalidateQueries({ queryKey: SPRINTS_QUERY_KEY });
  };

  const handleCreateSprint = async (values: Record<string, unknown>) => {
    if (submitting) return;

    setSubmitting(true);

    try {
      const created = await sprintApi.create(values as SprintDTO);
      setCreateOpen(false);
      await refreshSprints();

      if (created?.id != null) {
        setSelectedSprintId(created.id);
        setActiveTab("backlog");
      }

      toast.success("Đã tạo Sprint mới.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể tạo Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateSprint = async (values: Record<string, unknown>) => {
    if (!selectedSprint?.id || submitting) return;

    setSubmitting(true);

    try {
      await sprintApi.update(String(selectedSprint.id), {
        ...selectedSprint,
        ...values,
      } as SprintDTO);
      setEditOpen(false);
      await refreshSprints();
      await board.load();

      toast.success("Đã cập nhật phạm vi Sprint.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể cập nhật Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  const handleChangeStatus = async (status: SprintStatus) => {
    if (!selectedSprint?.id || statusUpdating) return;

    /** A sprint can only start once it holds at least one backlog item. */
    if (status === "ACTIVE" && board.sprintItems.length === 0) {
      toast.error(emptySprintBacklogMessage());
      return;
    }

    if (status === "COMPLETED") {
      const unfinished = unfinishedSprintItems(board.sprintItems);

      if (unfinished.length > 0) {
        toast.error(incompleteSprintMessage(unfinished.length));
        return;
      }
    }

    setStatusUpdating(true);

    try {
      await sprintApi.update(String(selectedSprint.id), {
        ...selectedSprint,
        status,
      } as SprintDTO);
      await refreshSprints();
      await board.load();

      toast.success(
        status === "COMPLETED"
          ? "Đã hoàn thành Sprint. Phạm vi công việc đã được khóa."
          : "Đã cập nhật trạng thái Sprint.",
      );
    } catch (error) {
      toast.error(
        extractErrorMessage(error, "Không thể cập nhật trạng thái Sprint."),
      );
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleDeleteSprint = async () => {
    if (!selectedSprint?.id) return;

    setSubmitting(true);

    try {
      await sprintApi.delete(String(selectedSprint.id));
      setDeleteOpen(false);
      setSelectedSprintId(null);
      await refreshSprints();

      toast.success("Đã xóa Sprint.");
    } catch (error) {
      toast.error(extractErrorMessage(error, "Không thể xóa Sprint."));
    } finally {
      setSubmitting(false);
    }
  };

  const editInitial = selectedSprint
    ? {
        ...selectedSprint,
        startDate: toDateTimeLocal(selectedSprint.startDate),
        endDate: toDateTimeLocal(selectedSprint.endDate),
      }
    : null;

  return (
    <MainLayout pathName={{ sprints: "Sprints" }}>
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col gap-3"
      >
        <SprintWorkspaceHeader
          sprint={selectedSprint}
          sprints={sprints}
          sprintItemCount={board.sprintItems.length}
          projectLabel={projectLabel}
          onSelectSprint={setSelectedSprintId}
          canCreate={canCreate}
          canUpdate={canUpdate}
          canDelete={canDelete}
          statusUpdating={statusUpdating}
          onOpenCreateSprint={() => setCreateOpen(true)}
          onAddBacklogItem={() => navigate("/backlogs")}
          onEditScope={() => setEditOpen(true)}
          onChangeStatus={(status) => void handleChangeStatus(status)}
          onDeleteSprint={() => setDeleteOpen(true)}
          tabs={
            <TabsList
              variant="line"
              className="h-auto! w-full flex-wrap justify-start gap-x-1 border-b pb-1"
            >
              {TAB_ITEMS.map((tab) => {
                const count = tabCounts[tab.value];

                return (
                  <TabsTrigger
                    key={tab.value}
                    value={tab.value}
                    className="flex-none px-2 pb-2 text-[11px] font-medium data-[state=active]:text-primary"
                  >
                    {tab.label}
                    {count !== undefined && (
                      <span
                        className={cn(
                          "ml-1 rounded-full bg-muted px-1.5 text-[10px] font-semibold text-muted-foreground",
                          activeTab === tab.value &&
                            "bg-primary/10 text-primary",
                        )}
                      >
                        {count}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          }
        />

        {sprintsQuery.isLoading ? (
          <Loading />
        ) : sprintsQuery.isError ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Unable to load the sprint list</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>
                {extractErrorMessage(
                  sprintsQuery.error,
                  "The sprint service did not answer. Please try again.",
                )}
              </span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => void sprintsQuery.refetch()}
              >
                <RefreshCw className="h-4 w-4" />
                Try again
              </Button>
            </AlertDescription>
          </Alert>
        ) : sprints.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed bg-muted/20 px-6 py-20 text-center">
            <span className="rounded-full bg-muted p-3 text-muted-foreground">
              <Layers className="h-5 w-5" />
            </span>
            <h2 className="mt-1 text-sm font-semibold">
              No sprint has been created yet
            </h2>
            <p className="max-w-md text-xs text-muted-foreground">
              Create the first sprint to plan the workspace backlog, track
              capacity and report progress.
            </p>
            {canCreate && (
              <Button
                size="sm"
                className="mt-2"
                onClick={() => setCreateOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Create Sprint
              </Button>
            )}
          </div>
        ) : (
          <>
            <TabsContent value="overview" className="mt-0">
              <OverviewTab
                sprints={sprints}
                selectedSprintId={selectedSprintId ?? undefined}
                sprintItems={board.sprintItems}
                productItems={board.productItems}
                onSelectSprint={(id) => {
                  setSelectedSprintId(id);
                  setActiveTab("backlog");
                }}
                onOpenBacklog={() => setActiveTab("backlog")}
              />
            </TabsContent>

            <TabsContent
              value="backlog"
              className="mt-0 flex min-h-0 flex-1 flex-col"
            >
              <SprintBacklogBoard
                board={board}
                canEdit={canEditBoard}
                canUpdate={canUpdate}
                statusUpdating={statusUpdating}
                onEditScope={() => setEditOpen(true)}
                onChangeStatus={(status) => void handleChangeStatus(status)}
                onBackToOverview={() => setActiveTab("overview")}
              />
            </TabsContent>
          </>
        )}
      </Tabs>

      <FormModal
        open={createOpen}
        onClose={setCreateOpen}
        schema={sprintSchema}
        title="Create Sprint"
        onSubmit={handleCreateSprint}
        isSubmitting={submitting}
      />

      <FormModal
        open={editOpen}
        onClose={setEditOpen}
        schema={sprintSchema}
        title="Edit Sprint Scope"
        initial={editInitial}
        onSubmit={handleUpdateSprint}
        isSubmitting={submitting}
      />

      <ConfirmDeleteModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onConfirm={handleDeleteSprint}
        loading={submitting}
        title="Delete sprint"
        description={
          selectedSprint
            ? `"${selectedSprint.name ?? selectedSprint.id}" will be removed. Backlog items that belong to it return to the product backlog.`
            : undefined
        }
      />
    </MainLayout>
  );
}
