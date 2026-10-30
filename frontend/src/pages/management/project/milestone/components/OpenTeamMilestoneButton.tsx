import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Play, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { milestoneApi } from "@/api/features/milestone.api";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { usePermissions } from "@/hooks/usePermissions";
import type { MilestoneLifecycleStatus } from "@/types";
import { normalizeRole } from "@/utils/rbac.utils";
import { getMilestoneApiError } from "../milestone.utils";

export function OpenTeamMilestoneButton({ teamId, milestoneId, title, lifecycleStatus, compact = false }: {
  teamId: number;
  milestoneId: string;
  title: string;
  lifecycleStatus: MilestoneLifecycleStatus;
  compact?: boolean;
}) {
  const { activeRole, hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const mutation = useMutation({
    mutationFn: async () => {
      // Read the current version: scheduled opening may have raced this dialog.
      const current = await milestoneApi.getTeamDetail(teamId, milestoneId);
      if (current.lifecycleStatus === "IN_PROGRESS") return;
      if (current.lifecycleStatus !== "PLANNED") throw new Error("This milestone is no longer planned. Refresh its status before continuing.");
      const published = current.status === "PLANNED"
        ? await milestoneApi.publish(undefined, teamId, milestoneId, current.version)
        : current;
      if (published.lifecycleStatus === "IN_PROGRESS") return;
      await milestoneApi.startTeam(teamId, milestoneId, published.version);
    },
    onSuccess: async () => {
      setOpen(false);
      toast.success("Milestone opened. Students can submit within the configured submission window.");
      await Promise.all([
        ["workspace-milestones"], ["team-milestone", teamId, milestoneId],
        ["workspace-artifacts-milestones", teamId], ["team-artifact-workspace", teamId, milestoneId],
        ["student-team-artifact-workspace", teamId, milestoneId], ["artifact-submission-workspace"],
        ["milestones"],
      ].map(queryKey => queryClient.invalidateQueries({ queryKey })));
    },
    onError: () => {
      void queryClient.invalidateQueries({ queryKey: ["workspace-milestones"] });
      void queryClient.invalidateQueries({ queryKey: ["team-milestone", teamId, milestoneId] });
    },
  });
  const canOpen = ["ADMIN", "ADMINISTRATOR", "SUPER_ADMIN", "SYSTEM_ADMIN"].includes(normalizeRole(activeRole))
    && hasPermission("MILESTONE_WRITE") && lifecycleStatus === "PLANNED";
  if (!canOpen && !open) return null;
  const error = mutation.isError ? getMilestoneApiError(mutation.error) : null;

  return <>
    <Button type="button" size="sm" variant="outline" className={compact ? "h-8 gap-1 px-2 text-xs" : undefined}
      title="Open milestone now" aria-label={`Open milestone ${title}`} disabled={mutation.isPending || !canOpen}
      onClick={() => { mutation.reset(); setOpen(true); }}><Play className="size-3.5" />{compact ? "Open" : "Open milestone"}</Button>
    <Dialog open={open} onOpenChange={next => { if (!mutation.isPending) setOpen(next); }}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg" showCloseButton={!mutation.isPending}>
        <DialogHeader><DialogTitle>Open milestone now?</DialogTitle><DialogDescription>Start this milestone manually instead of waiting for its scheduled opening.</DialogDescription></DialogHeader>
        <div className="space-y-3 text-sm">
          <p className="break-words rounded-lg border bg-muted/30 p-3 font-semibold [overflow-wrap:anywhere]">{title}</p>
          <p>The status will change to IN_PROGRESS. Students in this team can submit artifacts, subject to the existing deadline and late policy.</p>
          {error && <div role="alert" className="space-y-1 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
            <p>{mutation.error instanceof Error && !("response" in mutation.error) ? mutation.error.message : error.message}</p>
            {error.errors && Object.entries(error.errors).map(([field, messages]) => <p key={field}>{field}: {messages.join(" ")}</p>)}
          </div>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <RotateCw className="size-4 animate-spin" /> : <Play className="size-4" />}{mutation.isPending ? "Opening…" : "Open milestone"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </>;
}
