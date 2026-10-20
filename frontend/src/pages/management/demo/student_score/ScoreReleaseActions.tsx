import { studentScoreApi } from "@/api";
import ActionButton from "@/components/datatable/common/ActionButton";
import { PermissionGate } from "@/components/PermissionGate";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { StudentScoreDTO } from "@/types";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Eye, Pencil } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const SCORE_KEYS = ["quiz1", "quiz2", "assignment", "midterm", "final"];

const errorMessage = (error: any, fallback: string) =>
  error?.response?.data?.message ?? error?.response?.data?.detail ?? fallback;

const currentScores = (row?: StudentScoreDTO): Record<string, string> => {
  const result: Record<string, string> = {};
  const raw = row?.scores;
  if (raw && !Array.isArray(raw)) {
    Object.entries(raw).forEach(([key, value]) => {
      result[key] = value == null ? "" : String(value);
    });
  }
  SCORE_KEYS.forEach((key) => {
    if (!(key in result)) result[key] = "";
  });
  return result;
};

export function ScoreReleaseActions({ table }: { table: any }) {
  const queryClient = useQueryClient();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const selectedIds: any[] = table.selected ?? [];
  const row: StudentScoreDTO | undefined =
    selectedIds.length === 1
      ? (table.data as StudentScoreDTO[]).find((item) => item.id === selectedIds[0])
      : undefined;

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: [table.schema.entityName] });

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    try {
      await action();
      toast.success(success);
      await refresh();
      table.setSelected([]);
      return true;
    } catch (error) {
      toast.error(errorMessage(error, "Action failed."));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const openAdjust = () => {
    setReason("");
    setScores(currentScores(row));
    setAdjustOpen(true);
  };

  const submitAdjust = async () => {
    const payload: Record<string, number> = {};
    Object.entries(scores).forEach(([key, value]) => {
      if (value.trim() !== "" && !Number.isNaN(Number(value))) {
        payload[key] = Number(value);
      }
    });
    if (!reason.trim()) {
      toast.error("Reason is required.");
      return;
    }
    if (Object.keys(payload).length === 0) {
      toast.error("Enter at least one score.");
      return;
    }
    const ok = await run(
      () => studentScoreApi.adjust(row!.id!, { reason: reason.trim(), scores: payload }),
      "Score adjusted.",
    );
    if (ok) setAdjustOpen(false);
  };

  const canAct = (status: string[]) => !!row && status.includes(row.status ?? "");

  return (
    <>
      <PermissionGate permission="STUDENT_SCORE_UPDATE">
        <ActionButton
          title="Review"
          tooltip="Mark selected score as REVIEWED (select 1 DRAFT row)"
          icon={<Eye size={14} />}
          disabled={busy || !canAct(["DRAFT"])}
          onClick={() => run(() => studentScoreApi.review(row!.id!), "Score reviewed.")}
        />
      </PermissionGate>
      <PermissionGate permission="STUDENT_SCORE_RELEASE">
        <ActionButton
          title="Release"
          tooltip="Release selected score to student (select 1 REVIEWED row)"
          icon={<CheckCheck size={14} />}
          disabled={busy || !canAct(["REVIEWED"])}
          onClick={() => run(() => studentScoreApi.release(row!.id!), "Score released.")}
        />
        <ActionButton
          title="Adjust"
          tooltip="Adjust a released score with a reason (select 1 RELEASED or ADJUSTED row)"
          icon={<Pencil size={14} />}
          disabled={busy || !canAct(["RELEASED", "ADJUSTED"])}
          onClick={openAdjust}
        />
      </PermissionGate>

      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Adjust released score{row?.studentCode ? ` - ${row.studentCode}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              {Object.keys(scores).map((key) => (
                <div key={key} className="grid gap-1">
                  <Label htmlFor={`adjust-${key}`}>{key}</Label>
                  <Input
                    id={`adjust-${key}`}
                    type="number"
                    min={0}
                    max={10}
                    step="0.1"
                    value={scores[key]}
                    onChange={(e) => setScores((prev) => ({ ...prev, [key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="grid gap-1">
              <Label htmlFor="adjust-reason">Reason (required)</Label>
              <Textarea
                id="adjust-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitAdjust} disabled={busy}>
              Save adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
