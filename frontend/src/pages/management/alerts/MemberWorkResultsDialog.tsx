import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { projectAlertApi } from "@/api/features/project-alert.api";
import type { InactiveAlert } from "@/types/features/project-alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { getAlertError } from "./alert-errors";

const label=(value:string)=>value==="TODO"?"To do":value.toLowerCase().replaceAll("_"," ").replace(/^./,c=>c.toUpperCase());

export function MemberWorkResultsDialog({row,owner,onClose,onAccessChanged}:{
  row:InactiveAlert;owner:string;onClose:()=>void;onAccessChanged:()=>void;
}) {
  const query=useQuery({queryKey:["alert-member-work",owner,row.team.id,row.id],
    queryFn:({signal})=>projectAlertApi.memberWork(row.team.id,row.id,signal),retry:false,gcTime:0});
  const failure=query.isError?getAlertError(query.error):undefined;
  const notified=useRef(false);
  useEffect(()=>{
    if([401,403,404].includes(failure?.status??0)&&!notified.current){notified.current=true;onAccessChanged();}
  },[failure?.status,onAccessChanged]);
  // Never keep showing a previous successful response after access or scope changes.
  const data=failure?undefined:query.data;
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
    <DialogHeader><DialogTitle>Work results · {row.displayName}</DialogTitle>
      <DialogDescription>Current top-level backlog work assigned to this member in {row.team.name}. These results support manual assessment and do not change the member's activity status.</DialogDescription></DialogHeader>
    <div className="flex justify-end"><Button variant="outline" aria-label="Refresh work results" disabled={query.isFetching}
      onClick={()=>void query.refetch()}><RefreshCw className={query.isFetching?"size-4 animate-spin":"size-4"}/>Refresh results</Button></div>
    {query.isPending?<p role="status">Loading member work results...</p>:failure?<div className="space-y-3">
      <p role="alert" className="text-destructive">{failure.message}</p><Button variant="outline" onClick={()=>void query.refetch()}>Try again</Button>
    </div>:data&&<>
      <div className="flex flex-wrap gap-2" aria-label="Member work summary">
        <Badge variant="outline">Assigned: {data.summary.assigned}</Badge><Badge variant="outline">Done: {data.summary.done}</Badge>
        <Badge variant={data.summary.overdue>0?"destructive":"outline"}>Overdue: {data.summary.overdue}</Badge>
        <Badge variant="outline">In review: {data.summary.inReview}</Badge>
        <Badge variant="outline">Completion: {data.summary.percentage==null?"—":`${data.summary.percentage}%`}</Badge>
      </div>
      {!data.items.length?<p>No assigned backlog items. There is no work completion percentage to assess yet.</p>:<Table><TableHeader><TableRow>
        <TableHead>Backlog item</TableHead><TableHead>Status</TableHead><TableHead>Deadline</TableHead>
      </TableRow></TableHeader><TableBody>{data.items.map(item=><TableRow key={item.id}>
        <TableCell className="max-w-80 whitespace-normal"><p className="font-medium">{item.title}</p><p className="text-xs text-muted-foreground">{label(item.workType)}</p></TableCell>
        <TableCell><Badge variant="outline">{label(item.status)}</Badge></TableCell>
        <TableCell><p>{item.deadline?new Date(item.deadline).toLocaleString():"No deadline"}</p>
          {item.deadlineStatus==="OVERDUE"&&["TODO","IN_PROGRESS"].includes(item.status)&&<Badge variant="destructive">Overdue</Badge>}</TableCell>
      </TableRow>)}</TableBody></Table>}
      {data.summary.withoutDeadline>0&&<p className="text-sm text-muted-foreground">{data.summary.withoutDeadline} item(s) have no deadline and are excluded from the overdue count.</p>}
      <p className="text-xs text-muted-foreground">Completion = Done / all assigned backlog items × 100. Overdue counts To do / In progress items past their deadline. In-review work is shown separately. Done does not confirm review acceptance or on-time completion. Inactivity is assessed separately from completion, using task starts and pending Todo assignments.</p>
    </>}
  </DialogContent></Dialog>;
}
