import { sprintApi } from "@/api";
import type { SprintPlanning, SprintPlanningItem } from "@/types";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const SCOPE_LOCKED_FALLBACK =
  "Không thể thay đổi phạm vi công việc do Sprint đã hoàn thành/đã đóng";

const PRIORITY_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const priorityRank = (priority?: string | null) =>
  (priority && PRIORITY_RANK[priority]) || 0;

/** Product backlog is always shown highest priority first. */
export const sortByPriority = (
  items: SprintPlanningItem[],
): SprintPlanningItem[] =>
  [...items].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));

/**
 * Extracts the first business message from a 422/409/404 response so the UI can
 * show exactly what the Sprint Planning API rejected (AC02/AC03).
 */
export const extractErrorMessage = (
  error: unknown,
  fallback: string,
): string => {
  if (!axios.isAxiosError(error)) {
    return fallback;
  }

  const status = error.response?.status;
  const data = error.response?.data as
    | { message?: string; errors?: Record<string, string[]> }
    | undefined;

  const firstFieldError = data?.errors
    ? Object.values(data.errors)
        .flat()
        .find((message) => Boolean(message && message.trim()))
    : undefined;

  if (firstFieldError) {
    return String(firstFieldError);
  }

  if (typeof data?.message === "string" && data.message.trim()) {
    return data.message;
  }

  if (status === 422) {
    return SCOPE_LOCKED_FALLBACK;
  }

  return fallback;
};

export const isScopeLockedError = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 422;

export type BoardSide = "product" | "sprint";

export interface BoardDragState {
  id: number;
  from: BoardSide;
}

export interface UseSprintPlanningBoardOptions {
  /** Sprint whose backlog is being planned. Nothing is fetched while empty. */
  sprintId?: string;
  /** False when the user lacks SPRINT_UPDATE / TASK_UPDATE. */
  canEdit: boolean;
}

/**
 * State + actions of the Sprint Backlog board (UFR-PRJ-003-03).
 * <p>
 * Every mutation stays local until "Xác nhận gán" persists the whole board in a
 * single atomic call (AC01). A completed / cancelled sprint rejects the request
 * with 422 and the board reverts to the last server snapshot (AC02). While the
 * call is running every action is disabled (AC03).
 */
export function useSprintPlanningBoard({
  sprintId,
  canEdit,
}: UseSprintPlanningBoardOptions) {
  const [plan, setPlan] = useState<SprintPlanning | null>(null);
  const [sprintItems, setSprintItems] = useState<SprintPlanningItem[]>([]);
  const [productItems, setProductItems] = useState<SprintPlanningItem[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<number[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dragged, setDragged] = useState<BoardDragState | null>(null);
  const [dragTarget, setDragTarget] = useState<BoardSide | null>(null);

  const load = useCallback(async () => {
    if (!sprintId) {
      setPlan(null);
      setSprintItems([]);
      setProductItems([]);
      setLoading(false);
      setLoadError(null);
      return;
    }

    setLoading(true);
    setLoadError(null);

    try {
      const data = await sprintApi.getPlanning(sprintId);
      setPlan(data);
      setSprintItems(data.sprintItems ?? []);
      setProductItems(data.productBacklogItems ?? []);
      setSelectedProduct([]);
      setSelectedSprint([]);
    } catch (error) {
      setLoadError(
        extractErrorMessage(error, "Không thể tải dữ liệu Sprint Planning."),
      );
    } finally {
      setLoading(false);
    }
  }, [sprintId]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = plan ? !plan.canPlan : false;
  const interactionDisabled = saving || loading || !canEdit;

  const serverSprintIds = useMemo(
    () => (plan?.sprintItems ?? []).map((item) => item.id),
    [plan],
  );

  const currentSprintIds = useMemo(
    () => sprintItems.map((item) => item.id),
    [sprintItems],
  );

  const dirty =
    currentSprintIds.length !== serverSprintIds.length ||
    currentSprintIds.some((id, index) => id !== serverSprintIds[index]);

  const moveToSprint = (ids: number[]) => {
    if (!ids.length || interactionDisabled) {
      return;
    }

    const existing = new Set(currentSprintIds);
    const moving = ids
      .map((id) => productItems.find((item) => item.id === id))
      .filter(
        (item): item is SprintPlanningItem => !!item && !existing.has(item.id),
      );

    if (!moving.length) {
      return;
    }

    setSprintItems((previous) => [...previous, ...moving]);
    setProductItems((previous) =>
      previous.filter((item) => !ids.includes(item.id)),
    );
    setSelectedProduct((previous) => previous.filter((id) => !ids.includes(id)));
  };

  const moveToProduct = (ids: number[]) => {
    if (!ids.length || interactionDisabled) {
      return;
    }

    const moving = sprintItems.filter((item) => ids.includes(item.id));

    if (!moving.length) {
      return;
    }

    setSprintItems((previous) =>
      previous.filter((item) => !ids.includes(item.id)),
    );
    setProductItems((previous) =>
      sortByPriority([
        ...previous.filter((item) => !ids.includes(item.id)),
        ...moving,
      ]),
    );
    setSelectedSprint((previous) => previous.filter((id) => !ids.includes(id)));
  };

  const reorderBefore = (draggedId: number, targetId: number) => {
    setSprintItems((previous) => {
      const from = previous.findIndex((item) => item.id === draggedId);
      const to = previous.findIndex((item) => item.id === targetId);

      if (from < 0 || to < 0 || from === to) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(from, 1);
      next.splice(from < to ? to - 1 : to, 0, moved);

      return next;
    });
  };

  const moveWithinSprint = (id: number, offset: number) => {
    if (interactionDisabled) {
      return;
    }

    setSprintItems((previous) => {
      const index = previous.findIndex((item) => item.id === id);
      const target = index + offset;

      if (index < 0 || target < 0 || target >= previous.length) {
        return previous;
      }

      const next = [...previous];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);

      return next;
    });
  };

  const toggleProductSelection = (id: number) => {
    setSelectedProduct((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  };

  const toggleSprintSelection = (id: number) => {
    setSelectedSprint((previous) =>
      previous.includes(id)
        ? previous.filter((value) => value !== id)
        : [...previous, id],
    );
  };

  const clearSelection = () => {
    setSelectedProduct([]);
    setSelectedSprint([]);
  };

  /** AC01: one atomic call assigns, unassigns and saves the priority order. */
  const confirmPlan = async () => {
    if (!sprintId || saving || !canEdit) {
      return;
    }

    setSaving(true);

    try {
      const result = await sprintApi.updateBacklog(
        sprintId,
        sprintItems.map((item) => item.id),
      );

      setPlan(result);
      setSprintItems(result.sprintItems ?? []);
      setProductItems(result.productBacklogItems ?? []);
      clearSelection();

      toast.success("Đã cập nhật Sprint Backlog và thứ tự ưu tiên.");
    } catch (error) {
      // AC02: the server rejected the scope change (e.g. the sprint was
      // completed meanwhile) -> revert every moved item to its previous place.
      if (plan) {
        setSprintItems(plan.sprintItems ?? []);
        setProductItems(plan.productBacklogItems ?? []);
      }

      clearSelection();

      toast.error(
        extractErrorMessage(error, "Không thể cập nhật Sprint Backlog."),
      );

      if (isScopeLockedError(error)) {
        void load();
      }
    } finally {
      setSaving(false);
      setDragged(null);
      setDragTarget(null);
    }
  };

  return {
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
    load,
    moveToSprint,
    moveToProduct,
    reorderBefore,
    moveWithinSprint,
    toggleProductSelection,
    toggleSprintSelection,
    clearSelection,
    confirmPlan,
    setDragged,
    setDragTarget,
  };
}

export type SprintPlanningBoard = ReturnType<typeof useSprintPlanningBoard>;
