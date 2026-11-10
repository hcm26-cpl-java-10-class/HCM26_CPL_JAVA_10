import Loading from "@/components/datatable/common/Loading";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { SprintStatus } from "@/types";
import { ClipboardList, Loader2, Lock, RefreshCw, TriangleAlert } from "lucide-react";
import type { DragEvent } from "react";
import type { SprintPlanningBoard } from "../hooks/useSprintPlanningBoard";
import { ProductBacklogPanel } from "./ProductBacklogPanel";
import { SprintBacklogPanel } from "./SprintBacklogPanel";
import { SprintSummaryBar } from "./SprintSummaryBar";

interface SprintBacklogBoardProps {
  board: SprintPlanningBoard;
  canEdit: boolean;
  canUpdate: boolean;
  statusUpdating: boolean;
  onEditScope: () => void;
  onChangeStatus: (status: SprintStatus) => void;
  onBackToOverview: () => void;
}

/** Sprint ribbon + the two-panel sprint planning board of the workspace tab. */
export function SprintBacklogBoard({
  board,
  canEdit,
  canUpdate,
  statusUpdating,
  onEditScope,
  onChangeStatus,
  onBackToOverview,
}: SprintBacklogBoardProps) {
  const {
    plan,
    sprintItems,
    productItems,
    selectedProduct,
    selectedSprint,
    loading,
    saving,
    loadError,
    dragged,
    dragTarget,
    locked,
    interactionDisabled,
    dirty,
    moveToSprint,
    moveToProduct,
    reorderBefore,
    moveWithinSprint,
    toggleProductSelection,
    toggleSprintSelection,
    confirmPlan,
    setDragged,
    setDragTarget,
  } = board;

  const handleDragLeave = (event: DragEvent<HTMLElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setDragTarget(null);
    }
  };

  const handleSprintDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragTarget(null);

    if (dragged?.from === "product") {
      moveToSprint([dragged.id]);
    }

    setDragged(null);
  };

  const handleProductDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    setDragTarget(null);

    if (dragged?.from === "sprint") {
      moveToProduct([dragged.id]);
    }

    setDragged(null);
  };

  if (loading) {
    return <Loading />;
  }

  if (loadError) {
    return (
      <Alert variant="destructive">
        <TriangleAlert className="h-4 w-4" />
        <AlertTitle>Unable to load the sprint backlog</AlertTitle>
        <AlertDescription className="flex flex-col gap-2">
          <span>{loadError}</span>
          <Button
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => void board.load()}
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <SprintSummaryBar
        plan={plan}
        sprintItems={sprintItems}
        canUpdate={canUpdate}
        statusUpdating={statusUpdating}
        onEditScope={onEditScope}
        onChangeStatus={onChangeStatus}
        onBackToOverview={onBackToOverview}
      />

      {locked && plan?.statusMessage && (
        <Alert>
          <Lock className="h-4 w-4" />
          <AlertTitle>Sprint scope is locked</AlertTitle>
          <AlertDescription>{plan.statusMessage}</AlertDescription>
        </Alert>
      )}

      {dirty && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2",
          )}
        >
          <p className="flex items-center gap-2 text-xs font-medium text-primary">
            <ClipboardList className="h-4 w-4" />
            Unsaved scope changes — the sprint backlog order and assignments are
            not persisted yet.
          </p>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Draft</Badge>
            <Button
              size="sm"
              disabled={!canEdit || saving}
              onClick={() => void confirmPlan()}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardList className="h-4 w-4" />
              )}
              Confirm assignment
            </Button>
          </div>
        </div>
      )}

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-3 xl:grid-cols-2",
          saving && "pointer-events-none opacity-70",
        )}
      >
        <SprintBacklogPanel
          title={plan?.status === "ACTIVE" ? "Active Sprint Backlog" : "Sprint Backlog"}
          items={sprintItems}
          selectedIds={selectedSprint}
          disabled={interactionDisabled}
          saving={saving}
          isDropTarget={dragTarget === "sprint"}
          onToggleSelect={toggleSprintSelection}
          onMove={moveWithinSprint}
          onUnassign={(id) => moveToProduct([id])}
          onUnassignSelected={() => moveToProduct(selectedSprint)}
          onDragStart={(id) => setDragged({ id, from: "sprint" })}
          onDragEnter={(id) => {
            if (dragged?.from === "sprint" && dragged.id !== id) {
              reorderBefore(dragged.id, id);
            }
          }}
          onDragEnd={() => setDragged(null)}
          onDragOverPanel={() => setDragTarget("sprint")}
          onDragLeavePanel={handleDragLeave}
          onDropPanel={handleSprintDrop}
        />

        <ProductBacklogPanel
          items={productItems}
          sprintItems={sprintItems}
          sprintEndDate={plan?.endDate}
          selectedIds={selectedProduct}
          disabled={interactionDisabled}
          isDropTarget={dragTarget === "product"}
          onToggleSelect={toggleProductSelection}
          onAssign={(id) => moveToSprint([id])}
          onAssignSelected={() => moveToSprint(selectedProduct)}
          onDragStart={(id) => setDragged({ id, from: "product" })}
          onDragEnd={() => setDragged(null)}
          onDragOverPanel={() => setDragTarget("product")}
          onDragLeavePanel={handleDragLeave}
          onDropPanel={handleProductDrop}
        />
      </div>
    </div>
  );
}
