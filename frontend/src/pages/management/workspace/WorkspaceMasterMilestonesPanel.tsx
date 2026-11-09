import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { ChevronDown, ClipboardCheck, Upload } from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { milestoneStatusStyles } from "@/pages/management/project/milestone/milestone-status.styles";
import type { MilestoneLifecycleStatus } from "@/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ProjectCompletionPanel } from "./ProjectCompletionPanel";
import { describeDeadline } from "./workspace-milestone-deadline";
import { WorkspaceMilestoneRow } from "./WorkspaceMilestoneRow";

const toLifecycle = (status: string): MilestoneLifecycleStatus | null =>
  status in milestoneStatusStyles ? status as MilestoneLifecycleStatus : null;
const formatStatus = (status: string) =>
  status.replaceAll("_", " ").toLowerCase().replace(/^\w/, (char) => char.toUpperCase());

export function WorkspaceMasterMilestonesPanel({ masterProjectId, returnTo, onChanged }: {
  masterProjectId: number; returnTo: string; onChanged: () => void;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<{ id: string; title: string } | null>(null);
  const [url, setUrl] = useState("");
  const [notes, setNotes] = useState("");
  // null = automatic: expanded only when a milestone needs a submission recorded.
  const [collapsed, setCollapsed] = useState<boolean | null>(null);
  const [mountedAt] = useState(() => Date.now());
  const requestKey = useRef<string | null>(null);
  const query = useQuery({
    queryKey: ["workspace-master-milestones", masterProjectId, user.email, activeRole],
    queryFn: ({ signal }) => projectAssignmentApi.classMasterMilestones(masterProjectId, signal),
    retry: false, refetchInterval: 20_000,
  });
  const submit = useMutation({
    mutationFn: (milestoneId: string) => {
      requestKey.current ??= crypto.randomUUID();
      const payload = { evidenceUrl: url.trim(), notes: notes.trim() };
      return projectAssignmentApi.submitClassMaster(masterProjectId, milestoneId, payload, requestKey.current);
    },
    onSuccess: result => {
      setSelected(null); requestKey.current = null;
      void client.invalidateQueries({ queryKey: ["workspace-master-milestones"] });
      onChanged();
      navigate(`/milestone-submissions/${result.id}`, { state: { returnTo } });
    },
  });
  if (query.isError) return <Card className="py-4"><CardContent className="flex flex-wrap items-center justify-between gap-3 px-4 text-sm">
    <p role="alert" className="text-destructive">Unable to load master milestones.</p>
    <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Retry</Button></CardContent></Card>;
  if (query.isPending) return <div role="status" aria-label="Loading master milestones" className="space-y-2"><Skeleton className="h-10" /><Skeleton className="h-16" /></div>;
  const data = query.data;
  if (!data) return null;
  let validUrl = false;
  try { const parsed = new URL(url.trim()); validUrl = ["http:", "https:"].includes(parsed.protocol) && !!parsed.hostname && !parsed.username && !parsed.password; } catch { /* Wait for a complete URL. */ }
  const refresh = () => { void query.refetch(); onChanged(); };
  const actionable = data.milestones.filter(milestone => milestone.canSubmit).length;
  const isCollapsed = collapsed ?? actionable === 0;
  return <>
    <Card className="min-w-0 gap-0 overflow-hidden py-0">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
        <button type="button" className="flex min-w-0 items-center gap-2 text-left" aria-expanded={!isCollapsed} onClick={() => setCollapsed(!isCollapsed)}>
          <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", isCollapsed && "-rotate-90")} />
          <span className="min-w-0">
            <span className="block font-semibold">Master milestones <span className="font-normal text-muted-foreground">({data.milestones.length})</span>
              {actionable > 0 && <span className="ml-2 rounded-full bg-amber-100 px-1.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">{actionable} need action</span>}</span>
            <span className="block truncate text-xs text-muted-foreground">{data.projectName} · Managed by class mentors</span>
          </span>
        </button>
      </div>
      {!isCollapsed && <div className="border-t">
        {data.milestones.length === 0 ? <p className="px-4 py-6 text-center text-sm text-muted-foreground">No master milestones configured.</p>
          : data.milestones.map(milestone => {
            const lifecycle = milestone.waived ? null : toLifecycle(milestone.status);
            return <WorkspaceMilestoneRow key={milestone.id}
              title={milestone.title} description={milestone.description} status={lifecycle}
              statusLabel={milestone.waived ? "Waived" : lifecycle ? undefined : formatStatus(milestone.status)}
              deadline={describeDeadline(milestone.deadline, lifecycle, query.dataUpdatedAt || mountedAt)}
              badges={<>
                <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">Master</Badge>
                <Badge variant="outline" className="px-1.5 py-0 text-[10px] font-medium text-muted-foreground">{milestone.mandatory ? "Mandatory" : "Optional"}</Badge>
              </>}
              primaryAction={<>
                {milestone.canSubmit && <Button size="sm" onClick={() => {
                  submit.reset(); requestKey.current = null; setUrl(""); setNotes(""); setSelected(milestone);
                }}><Upload className="size-4" /> Record submission</Button>}
                {milestone.submissionId && <Button size="sm" variant="outline" onClick={() => navigate(`/milestone-submissions/${milestone.submissionId}`,
                  { state: { returnTo } })}><ClipboardCheck className="size-4" /> Review / history</Button>}
              </>} />;
          })}
      </div>}
    </Card>
    {data.canManage && <ProjectCompletionPanel key={`${data.projectId}:${data.teamId}`}
      projectId={data.projectId} teamId={data.teamId} title={`Master completion — ${data.projectName}`}
      readOnly={data.readOnly} onChanged={refresh} />}
    <Dialog open={selected !== null} onOpenChange={open => { if (!open && !submit.isPending) setSelected(null); }}><DialogContent>
      <DialogHeader><DialogTitle>Record shared master submission</DialogTitle><DialogDescription>
        {selected?.title}. Record the common deliverable on behalf of the class, then review it using the milestone rubric.
      </DialogDescription></DialogHeader>
      <div className="space-y-2"><Label htmlFor="master-evidence-url">Evidence link</Label>
        <Input id="master-evidence-url" type="url" maxLength={1000} placeholder="https://…" value={url} disabled={submit.isPending}
          onChange={event => { setUrl(event.target.value); requestKey.current = null; }} /></div>
      <div className="space-y-2"><Label htmlFor="master-evidence-notes">Submission notes</Label>
        <Textarea id="master-evidence-notes" maxLength={2000} value={notes} disabled={submit.isPending}
          onChange={event => { setNotes(event.target.value); requestKey.current = null; }} /></div>
      {submit.isError && <p role="alert" className="text-sm text-destructive">{axios.isAxiosError<{ message?: string }>(submit.error)
        ? submit.error.response?.data?.message ?? "Unable to record this submission." : "Unable to record this submission."}</p>}
      <DialogFooter><Button variant="outline" disabled={submit.isPending} onClick={() => setSelected(null)}>Cancel</Button>
        <Button disabled={!validUrl || submit.isPending || data.readOnly} onClick={() => selected && submit.mutate(selected.id)}>
          {submit.isPending ? "Submitting…" : "Submit for review"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </>;
}
