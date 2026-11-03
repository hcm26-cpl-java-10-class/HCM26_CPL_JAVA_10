import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { CheckCircle2, LockKeyhole } from "lucide-react";
import { projectAssignmentApi } from "@/api/features/project-assignment.api";
import { usePermissions } from "@/hooks/usePermissions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const message = (error: unknown) => axios.isAxiosError<{ message?: string }>(error)
  ? error.response?.data?.message ?? "Unable to save the assessment. Please try again." : "Unable to save the assessment. Please try again.";

export function ProjectCompletionPanel({ workspaceId, projectId, teamId, readOnly, onChanged, title = "Project completion" }: {
  workspaceId?: number; projectId: number; teamId: number | null; readOnly: boolean; onChanged: () => void; title?: string;
}) {
  const { user, activeRole } = usePermissions();
  const client = useQueryClient();
  const [score, setScore] = useState("");
  const [gradeDialog, setGradeDialog] = useState(false);
  const [waiver, setWaiver] = useState<{ id: string; title: string } | null>(null);
  const [reason, setReason] = useState("");
  const sending = useRef(false);
  const summary = useQuery({
    queryKey: ["project-completion", projectId, teamId, user.email, activeRole],
    queryFn: ({ signal }) => projectAssignmentApi.completion(projectId, teamId, signal), retry: false,
  });
  const save = useMutation({
    mutationFn: (request: { kind: "grade"; value: number } | { kind: "waiver"; id: string; reason: string }) => request.kind === "grade"
      ? projectAssignmentApi.lockGrade(projectId, teamId, request.value)
      : projectAssignmentApi.waive(projectId, teamId, request.id, request.reason),
    onSuccess: () => {
      setGradeDialog(false); setWaiver(null); setReason("");
      void client.invalidateQueries({ queryKey: ["project-completion", projectId, teamId] });
      void client.invalidateQueries({ queryKey: ["workspace-milestones", projectId, teamId] });
      void client.invalidateQueries({ queryKey: ["workspace-project-hierarchy", workspaceId] });
      void client.invalidateQueries({ queryKey: ["workspace-master-milestones"] });
      onChanged();
    },
    onSettled: () => { sending.current = false; },
  });
  const data = summary.data;
  const canManage = !readOnly && !!data?.canManage && !data.completed && !summary.isError;
  const parsed = Number(score);
  const validScore = score.trim() !== "" && /^\d{1,3}(\.\d{1,2})?$/.test(score) && parsed >= 0 && parsed <= 100;
  function submitGrade() {
    if (!canManage || !validScore || sending.current) return;
    sending.current = true; save.mutate({ kind: "grade", value: parsed });
  }
  function submitWaiver() {
    if (!canManage || !waiver || !reason.trim() || reason.trim().length > 500 || sending.current) return;
    sending.current = true; save.mutate({ kind: "waiver", id: waiver.id, reason: reason.trim() });
  }
  if (summary.isError) return <Card><CardContent className="space-y-2 pt-5"><p role="alert">Unable to load the project completion status.</p>
    <Button size="sm" variant="outline" onClick={() => void summary.refetch()}>Retry</Button></CardContent></Card>;
  if (!data) return <p role="status" className="text-sm text-muted-foreground">Loading project completion…</p>;
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="size-4" />{title}</CardTitle></CardHeader>
    <CardContent className="space-y-4"><div className="flex flex-wrap gap-2"><Badge variant="outline">{data.completed ? "Completed" : "In progress"}</Badge>
      <Badge variant="outline">{data.gradeLocked ? "Final grade locked" : "Final grade pending"}</Badge>
      {!data.childrenCompleted && <Badge variant="outline">Waiting for child projects</Badge>}</div>
      <p className="text-xs text-muted-foreground">Completion requires all mandatory milestones to be accepted or waived, a locked final grade, and completed child projects.</p>
      {data.milestones.filter(milestone => milestone.mandatory).map(milestone => <div key={milestone.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
        <span>{milestone.title}</span><div className="flex items-center gap-2"><Badge variant="outline">{milestone.waived ? "Waived" : milestone.accepted ? "Accepted" : "Pending"}</Badge>
          {canManage && !milestone.accepted && !milestone.waived && <Button size="sm" variant="outline" onClick={() => { save.reset(); setReason(""); setWaiver(milestone); }}>Waive milestone</Button>}</div></div>)}
      {data.canManage && data.gradeLocked && data.finalScore !== null && <p className="text-sm font-medium">Locked final score: {data.finalScore}</p>}
      {canManage && !data.gradeLocked && <div className="flex flex-wrap items-end gap-3"><div className="space-y-2"><Label htmlFor={`final-grade-${projectId}`}>Final score (0–100)</Label>
        <Input id={`final-grade-${projectId}`} className="w-40" inputMode="decimal" value={score} onChange={event => setScore(event.target.value)} disabled={save.isPending} /></div>
        <Button variant="outline" disabled={!validScore || save.isPending} onClick={() => { save.reset(); setGradeDialog(true); }}><LockKeyhole className="size-4" />Lock final grade</Button></div>}
    </CardContent>
    <Dialog open={gradeDialog} onOpenChange={open => { if (!save.isPending) setGradeDialog(open); }}><DialogContent>
      <DialogHeader><DialogTitle>Lock final grade?</DialogTitle><DialogDescription>The final score will be locked at {score}. Later score changes require an authorized grade adjustment.</DialogDescription></DialogHeader>
      {save.isError && <p role="alert" className="text-destructive">{message(save.error)}</p>}
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setGradeDialog(false)}>Cancel</Button><Button disabled={!canManage || save.isPending} onClick={submitGrade}>{save.isPending ? "Saving…" : "Confirm grade lock"}</Button></DialogFooter>
    </DialogContent></Dialog>
    <Dialog open={waiver !== null} onOpenChange={open => { if (!open && !save.isPending) setWaiver(null); }}><DialogContent>
      <DialogHeader><DialogTitle>Waive milestone</DialogTitle><DialogDescription>{waiver?.title} will satisfy its completion requirement through an approved exception.</DialogDescription></DialogHeader>
      <Label htmlFor="milestone-waiver-reason">Reason</Label><Textarea id="milestone-waiver-reason" value={reason} onChange={event => setReason(event.target.value)} maxLength={500} disabled={save.isPending} />
      {save.isError && <p role="alert" className="text-destructive">{message(save.error)}</p>}
      <DialogFooter><Button variant="outline" disabled={save.isPending} onClick={() => setWaiver(null)}>Cancel</Button><Button disabled={!canManage || !reason.trim() || save.isPending} onClick={submitWaiver}>{save.isPending ? "Saving…" : "Confirm waiver"}</Button></DialogFooter>
    </DialogContent></Dialog>
  </Card>;
}
