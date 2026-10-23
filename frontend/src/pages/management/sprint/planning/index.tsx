import { sprintApi } from "@/api";
import Loading from "@/components/datatable/common/Loading";
import { MainLayout } from "@/components/layout/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { usePermissions } from "@/hooks/usePermissions";
import { cn } from "@/lib/utils";
import type { SprintPlanning, SprintPlanningItem } from "@/types";
import axios from "axios";
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Flag,
  GripVertical,
  Layers,
  Loader2,
  RefreshCw,
  TriangleAlert,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";

const SCOPE_LOCKED_FALLBACK =
  "Không thể thay đổi phạm vi công việc do Sprint đã hoàn thành/đã đóng";

const PRIORITY_RANK: Record<string, number> = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  URGENT: 4,
};

const PRIORITY_STYLES: Record<string, string> = {
  LOW: "border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-300",
  MEDIUM:
    "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-900/40 dark:text-sky-300",
  HIGH: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  URGENT:
    "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-900/40 dark:text-rose-300",
};

const formatDate = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};

const priorityRank = (priority?: string | null) =>
  (priority && PRIORITY_RANK[priority]) || 0;

const sortByPriority = (items: SprintPlanningItem[]) =>
  [...items].sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));

/**
 * Extracts the first business message from a 422/409/404 response so the UI can
 * show exactly what the Sprint Planning API rejected (AC02/AC03).
 */
const extractErrorMessage = (error: unknown, fallback: string): string => {
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

const isScopeLockedError = (error: unknown) =>
  axios.isAxiosError(error) && error.response?.status === 422;

interface PlanItemCardProps {
  item: SprintPlanningItem;
  selected: boolean;
  disabled: boolean;
  draggable: boolean;
  order?: number;
  onSelect: (id: number) => void;
  onDragStart?: (id: number) => void;
  onDragEnter?: (id: number) => void;
  onDragEnd?: () => void;
  children?: ReactNode;
}

/** Shared row of both planning panels. */
function PlanItemCard({
  item,
  selected,
  disabled,
  draggable,
  order,
  onSelect,
  onDragStart,
  onDragEnter,
  onDragEnd,
  children,
}: PlanItemCardProps) {
  return (
    <div
      draggable={draggable && !disabled}
      onDragStart={(event) => {
        if (disabled) {
          event.preventDefault();
          return;
        }

        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(item.id));
        onDragStart?.(item.id);
      }}
      onDragEnter={() => {
        if (!disabled) {
          onDragEnter?.(item.id);
        }
      }}
      onDragEnd={() => onDragEnd?.()}
      className={cn(
        "flex items-start gap-2 rounded-lg border bg-card px-2.5 py-2 shadow-xs transition-colors",
        disabled
          ? "opacity-60"
          : "hover:border-primary/50 hover:bg-accent/40",
        selected && "border-primary/60 bg-primary/5",
      )}
    >
      <GripVertical
        className={cn(
          "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground",
          draggable && !disabled ? "cursor-grab" : "opacity-30",
        )}
      />

      <Checkbox
        checked={selected}
        disabled={disabled}
        onCheckedChange={() => onSelect(item.id)}
        className="mt-0.5"
      />

      {order !== undefined && (
        <span className="mt-0.5 inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 px-1 text-[11px] font-semibold text-primary">
          {order}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">
          {item.title || `Backlog item #${item.id}`}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <Badge
            variant="outline"
            className={cn(
              "px-1.5 py-0 text-[10px] uppercase",
              PRIORITY_STYLES[item.priority ?? ""] ?? "",
            )}
          >
            {item.priority ?? "—"}
          </Badge>
          {item.milestoneName && (
            <span className="inline-flex min-w-0 items-center gap-1">
              <Flag className="h-3 w-3 shrink-0" />
              <span className="truncate">
                {item.milestoneName}
                {item.milestoneDueDate
                  ? ` • hạn ${formatDate(item.milestoneDueDate)}`
                  : ""}
              </span>
            </span>
          )}
          {typeof item.estimatedHours === "number" && (
            <span>{item.estimatedHours}h</span>
          )}
        </div>
      </div>

      {children}
    </div>
  );
}

/**
 * Sprint Planning board (UFR-PRJ-003-03).
 * <p>
 * Left: Product Backlog. Right: Sprint Backlog, ordered by priority. Items can
 * be selected and moved with the buttons or dragged & dropped; the whole board
 * is persisted atomically with "Xác nhận gán" (AC01). A completed / cancelled
 * sprint answers 422 and the board reverts to the last server snapshot (AC02).
 * While the API call is running every action is disabled (AC03).
 */
export default function SprintPlanningPage() {
  const { sprintId } = useParams<{ sprintId: string }>();
  const navigate = useNavigate();
  const { hasAllPermissions } = usePermissions();

  const canEdit = hasAllPermissions(["SPRINT_UPDATE", "TASK_UPDATE"]);

  const [plan, setPlan] = useState<SprintPlanning | null>(null);
  const [sprintItems, setSprintItems] = useState<SprintPlanningItem[]>([]);
  const [productItems, setProductItems] = useState<SprintPlanningItem[]>([]);

  const [selectedProduct, setSelectedProduct] = useState<number[]>([]);
  const [selectedSprint, setSelectedSprint] = useState<number[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dragged, setDragged] = useState<{
    id: number;
    from: "product" | "sprint";
  } | null>(null);
  const [dragTarget, setDragTarget] = useState<"product" | "sprint" | null>(
    null,
  );

  const load = useCallback(async () => {
    if (!sprintId) {
      setLoading(false);
      setLoadError("Không tìm thấy Sprint cần lập kế hoạch.");
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

  const serverSprintIds = (plan?.sprintItems ?? []).map((item) => item.id);
  const currentSprintIds = sprintItems.map((item) => item.id);
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
    setSelectedProduct((previous) =>
      previous.filter((id) => !ids.includes(id)),
    );
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
    setSelectedSprint((previous) =>
      previous.filter((id) => !ids.includes(id)),
    );
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

  /**
   * AC01: one atomic call assigns, unassigns and saves the priority order.
   */
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
      setSelectedProduct([]);
      setSelectedSprint([]);

      toast.success("Đã cập nhật Sprint Backlog và thứ tự ưu tiên.");
    } catch (error) {
      // AC02: the server rejected the scope change (e.g. the sprint was
      // completed meanwhile) -> revert every moved item to its previous place.
      if (plan) {
        setSprintItems(plan.sprintItems ?? []);
        setProductItems(plan.productBacklogItems ?? []);
      }

      setSelectedProduct([]);
      setSelectedSprint([]);

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

  return (
    <MainLayout pathName={{ planning: "Sprint Planning", sprints: "Sprints" }}>
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                title="Quay lại danh sách Sprint"
                onClick={() => navigate("/sprints")}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="truncate text-lg font-semibold">
                Sprint Planning
              </h1>
              {plan?.status && (
                <Badge variant="outline" className="uppercase">
                  {plan.status}
                </Badge>
              )}
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">
              {plan?.sprintName ?? `Sprint #${sprintId ?? "—"}`}
              {plan?.sprintGoal ? ` — ${plan.sprintGoal}` : ""}
            </p>
            {plan && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(plan.startDate)} →{" "}
                {formatDateTime(plan.endDate)}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            {dirty && <Badge variant="secondary">Chưa lưu</Badge>}
            <Button
              onClick={() => void confirmPlan()}
              disabled={!canEdit || saving || loading || !dirty}
              title={
                canEdit
                  ? "Xác nhận gán Backlog item vào Sprint"
                  : "Bạn không có quyền lập kế hoạch Sprint"
              }
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ClipboardList className="h-4 w-4" />
              )}
              Xác nhận gán
            </Button>
          </div>
        </div>

        {/* AC02: warning for a closed sprint */}
        {locked && plan?.statusMessage && (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Không thể thay đổi phạm vi công việc</AlertTitle>
            <AlertDescription>{plan.statusMessage}</AlertDescription>
          </Alert>
        )}

        {loading ? (
          <Loading />
        ) : loadError ? (
          <Alert variant="destructive">
            <TriangleAlert className="h-4 w-4" />
            <AlertTitle>Không tải được Sprint Planning</AlertTitle>
            <AlertDescription className="flex flex-col gap-2">
              <span>{loadError}</span>
              <Button
                variant="outline"
                size="sm"
                className="w-fit"
                onClick={() => void load()}
              >
                <RefreshCw className="h-4 w-4" />
                Thử lại
              </Button>
            </AlertDescription>
          </Alert>
        ) : (
          <div
            className={cn(
              "grid min-h-0 flex-1 gap-4 lg:grid-cols-2",
              saving && "pointer-events-none opacity-70",
            )}
          >
            {/* Product Backlog */}
            <section
              className={cn(
                "flex min-h-[320px] flex-col rounded-xl border bg-muted/30 p-3 transition-colors",
                dragTarget === "product" && "border-primary bg-primary/5",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                if (!interactionDisabled) {
                  setDragTarget("product");
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragTarget(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragTarget(null);
                if (dragged?.from === "sprint") {
                  moveToProduct([dragged.id]);
                }
                setDragged(null);
              }}
            >
              <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Layers className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Product Backlog</h2>
                  <Badge variant="secondary">{productItems.length}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={
                    interactionDisabled || selectedProduct.length === 0
                  }
                  onClick={() => moveToSprint(selectedProduct)}
                  title="Gán các Backlog item đã chọn vào Sprint"
                >
                  <ArrowRight className="h-4 w-4" />
                  Gán vào Sprint
                  {selectedProduct.length > 0
                    ? ` (${selectedProduct.length})`
                    : ""}
                </Button>
              </header>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {productItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    Không còn Backlog item nào trong Product Backlog.
                  </p>
                ) : (
                  productItems.map((item) => (
                    <PlanItemCard
                      key={item.id}
                      item={item}
                      selected={selectedProduct.includes(item.id)}
                      disabled={interactionDisabled}
                      draggable
                      onSelect={toggleProductSelection}
                      onDragStart={(id) =>
                        setDragged({ id, from: "product" })
                      }
                      onDragEnd={() => setDragged(null)}
                    >
                      <Button
                        size="icon-xs"
                        variant="ghost"
                        disabled={interactionDisabled}
                        title="Gán vào Sprint"
                        onClick={() => moveToSprint([item.id])}
                      >
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </PlanItemCard>
                  ))
                )}
              </div>
            </section>

            {/* Sprint Backlog */}
            <section
              className={cn(
                "flex min-h-[320px] flex-col rounded-xl border bg-muted/30 p-3 transition-colors",
                dragTarget === "sprint" && "border-primary bg-primary/5",
              )}
              onDragOver={(event) => {
                event.preventDefault();
                if (!interactionDisabled) {
                  setDragTarget("sprint");
                }
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragTarget(null);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                setDragTarget(null);
                if (dragged?.from === "product") {
                  moveToSprint([dragged.id]);
                }
                setDragged(null);
              }}
            >
              <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-muted-foreground" />
                  <h2 className="text-sm font-semibold">Sprint Backlog</h2>
                  <Badge variant="secondary">{sprintItems.length}</Badge>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={interactionDisabled || selectedSprint.length === 0}
                  onClick={() => moveToProduct(selectedSprint)}
                  title="Hủy gán các Backlog item đã chọn về Product Backlog"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Hủy gán
                  {selectedSprint.length > 0 ? ` (${selectedSprint.length})` : ""}
                </Button>
              </header>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto pr-1">
                {sprintItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                    Sprint Backlog đang trống. Kéo thả hoặc chọn Backlog item từ
                    Product Backlog.
                  </p>
                ) : (
                  sprintItems.map((item, index) => (
                    <PlanItemCard
                      key={item.id}
                      item={item}
                      order={index + 1}
                      selected={selectedSprint.includes(item.id)}
                      disabled={interactionDisabled}
                      draggable
                      onSelect={toggleSprintSelection}
                      onDragStart={(id) => setDragged({ id, from: "sprint" })}
                      onDragEnter={(id) => {
                        if (dragged?.from === "sprint" && dragged.id !== id) {
                          reorderBefore(dragged.id, id);
                        }
                      }}
                      onDragEnd={() => setDragged(null)}
                    >
                      <div className="flex shrink-0 items-center gap-0.5">
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={interactionDisabled || index === 0}
                          title="Ưu tiên cao hơn"
                          onClick={() => moveWithinSprint(item.id, -1)}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={
                            interactionDisabled ||
                            index === sprintItems.length - 1
                          }
                          title="Ưu tiên thấp hơn"
                          onClick={() => moveWithinSprint(item.id, 1)}
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="icon-xs"
                          variant="ghost"
                          disabled={interactionDisabled}
                          title="Hủy gán khỏi Sprint"
                          onClick={() => moveToProduct([item.id])}
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </PlanItemCard>
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </MainLayout>
  );
}
