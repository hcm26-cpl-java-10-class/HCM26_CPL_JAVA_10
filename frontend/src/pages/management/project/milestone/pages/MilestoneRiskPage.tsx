import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { milestoneRiskApi } from "@/api/features/milestone-risk.api";
import { usePermissions } from "@/hooks/usePermissions";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TaskProjectPicker } from "@/pages/management/task/components/TaskProjectPicker";
import { MilestoneRiskAlertDialog } from "../components/MilestoneRiskAlertDialog";
import { getMilestoneApiError, formatDateTime } from "../milestone.utils";
import { listMilestoneDrafts, milestoneDraftScope, removeMilestoneDraft } from "../milestone-risk-drafts";
import type { MilestoneRiskItem } from "@/types/features/milestone-risk";

function RiskHistory({ projectId, milestoneId }: { projectId: string; milestoneId: string }) {
  const { user, activeRole }=usePermissions();
  const query=useQuery({queryKey:["milestone-risk-history",user.email,activeRole,projectId,milestoneId],
    queryFn:({signal})=>milestoneRiskApi.history(projectId,milestoneId,signal),retry:false,gcTime:0});
  return query.isPending ? <p role="status">Loading alert history...</p>
    : query.isError ? <div><p role="alert">{getMilestoneApiError(query.error).message}</p><Button variant="outline" onClick={()=>void query.refetch()}>Try again</Button></div>
    : !query.data.length ? <p>No risk alerts yet.</p> : <div className="divide-y">{query.data.map(item=><div key={item.alertId} className="space-y-2 py-3">
      <div className="flex justify-between gap-3"><span>{formatDateTime(item.createdAt)}</span><Badge variant="outline">{item.status==="PENDING"?"Queued":"Published"}</Badge></div>
      <p className="whitespace-pre-wrap break-words">{item.warningNote}</p></div>)}</div>;
}
export function MilestoneRiskPage() {
  const {projectId=""}=useParams<{projectId:string}>();
  const {user,activeRole,hasPermission}=usePermissions();
  return <MilestoneRiskContent key={`${user.email}:${activeRole}:${projectId}`} projectId={projectId} hasSendPermission={hasPermission("MILESTONE_ALERT_SEND")} />;
}
function MilestoneRiskContent({projectId,hasSendPermission}:{projectId:string;hasSendPermission:boolean}) {
  const {user,activeRole}=usePermissions();
  const navigate=useNavigate(), client=useQueryClient();
  const [atRiskOnly,setAtRiskOnly]=useState(true), [selected,setSelected]=useState<MilestoneRiskItem|null>(null);
  const [historyId,setHistoryId]=useState<string>(),[,setDraftRevision]=useState(0);
  const query=useQuery({queryKey:["milestone-risks",user.email,activeRole,projectId,atRiskOnly],
    queryFn:({signal})=>milestoneRiskApi.list(projectId,atRiskOnly,signal),enabled:!!projectId,retry:false,gcTime:0});
  const data=query.isError?undefined:query.data;
  const scope=data?milestoneDraftScope(data.tenantId,data.actorId,projectId):"";
  const drafts=scope?listMilestoneDrafts(scope):[];
  const canSend=!!data?.canSend && hasSendPermission;
  const url=`/projects/${projectId}/milestones?view=risk`;
  async function reload() {
    const result=await query.refetch();
    if (result.isSuccess) setSelected(previous=>previous ? result.data.content.find(item=>item.id===previous.id)??{...previous,canSend:false,progress:{...previous.progress,eligible:false}} : null);
  }
  return <MainLayout pathName={{projects:"Projects",milestones:"Milestone risk monitoring"}}>
    <section className="grid min-w-0 gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-xl font-semibold">Milestone risk monitoring</h1>
        <p className="text-sm text-muted-foreground">{data?.projectName??"Select a project to monitor milestone risk."}</p></div>
        <Button variant="outline" onClick={()=>navigate(`/tasks?projectId=${projectId}`)}>Back to tasks</Button></div>
      <details className="rounded-lg border p-3" open={!data}><summary className="cursor-pointer text-sm">Change project</summary>
        <div className="mt-3"><TaskProjectPicker projectId={projectId} onSelect={id=>navigate(`/projects/${id}/milestones?view=risk`)}/></div></details>
      {drafts.length>0 && <Card><CardHeader><CardTitle>Saved warning drafts</CardTitle></CardHeader><CardContent className="grid gap-3">
        <p className="text-sm text-muted-foreground">Drafts remain available if a milestone is removed. Each draft belongs to its original milestone.</p>
        {drafts.map(draft=><details key={draft.milestoneId} className="min-w-0 rounded border p-3"><summary className="cursor-pointer">{draft.title}</summary>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm">{draft.note||"(Empty note — use the default warning)"}</p>
          <Button className="mt-2" variant="outline" size="sm" onClick={()=>{removeMilestoneDraft(scope,draft.milestoneId);setDraftRevision(value=>value+1);}}>Discard draft</Button></details>)}
      </CardContent></Card>}
      <Card><CardHeader><div className="flex flex-wrap justify-between gap-3"><CardTitle>Milestones</CardTitle><div className="flex gap-2">
        <Button variant={atRiskOnly?"default":"outline"} onClick={()=>setAtRiskOnly(true)}>At-risk milestones</Button>
        <Button variant={atRiskOnly?"outline":"default"} onClick={()=>setAtRiskOnly(false)}>All milestones</Button>
        <Button variant="outline" disabled={query.isFetching} onClick={()=>void reload()}>Refresh</Button>
      </div></div><p className="text-sm text-muted-foreground">Open milestones due in less than 48 hours with completion below 80%, including milestones without tasks.</p></CardHeader>
      <CardContent>
        {query.isPending?<p role="status">Loading milestones...</p>:query.isError?<div className="space-y-3"><p role="alert">{getMilestoneApiError(query.error).message}</p>
          <Button variant="outline" onClick={()=>void reload()}>Try again</Button></div>
          : !data?.content.length?<p className="py-8 text-center text-muted-foreground">{atRiskOnly?"No milestones currently meet the risk conditions.":"No milestones available."}</p>
          : <Table><TableHeader><TableRow><TableHead>Milestone</TableHead><TableHead>Deadline</TableHead><TableHead>Task completion</TableHead><TableHead>Risk</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
            <TableBody>{data.content.map(item=><TableRow key={item.id}><TableCell><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{item.status}</p></TableCell>
              <TableCell>{formatDateTime(item.deadline)}</TableCell>
              <TableCell>{item.progress.doneTasks}/{item.progress.totalTasks} tasks ({item.progress.completionRate}%){item.progress.totalTasks===0&&<p className="text-xs text-muted-foreground">No tasks planned</p>}</TableCell>
              <TableCell>{item.atRisk?<Badge variant="destructive">At-Risk</Badge>:item.progress.eligible?<Badge variant="outline">Risk detected</Badge>:<span>—</span>}</TableCell>
              <TableCell><div className="flex flex-wrap gap-2">{canSend&&<Button size="sm" disabled={!item.canSend||query.isFetching} onClick={()=>setSelected(item)}>Send risk alert</Button>}
                <Button variant="outline" size="sm" onClick={()=>setHistoryId(item.id)}>Alert history</Button></div></TableCell></TableRow>)}</TableBody></Table>}
      </CardContent></Card>
      {selected&&data&&<MilestoneRiskAlertDialog projectId={projectId} milestone={selected} scope={scope} enabled={canSend&&!query.isFetching}
        onClose={()=>{setSelected(null);setDraftRevision(value=>value+1);}}
        onMissing={()=>{setSelected(null);setDraftRevision(value=>value+1);navigate(url,{replace:true});void client.invalidateQueries({queryKey:["milestone-risks"]});}}
        onSent={()=>{removeMilestoneDraft(scope,selected.id);setSelected(null);setDraftRevision(value=>value+1);
          void client.invalidateQueries({queryKey:["milestone-risks"]});void client.invalidateQueries({queryKey:["milestone-risk-history"]});}}
        onReload={reload}/>}
      {historyId&&data&&<Dialog open onOpenChange={open=>{if(!open)setHistoryId(undefined);}}><DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Milestone alert history</DialogTitle></DialogHeader><RiskHistory projectId={projectId} milestoneId={historyId}/></DialogContent></Dialog>}
    </section>
  </MainLayout>;
}
