import type { MilestoneAlert } from "@/types/features/project-alert";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function MilestoneMemberProgressDialog({row,onClose}:{row:MilestoneAlert;onClose:()=>void}) {
  const members=row.canViewMemberProgress?row.memberProgress??[]:[];
  return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
    <DialogHeader><DialogTitle>Member progress · {row.title}</DialogTitle>
      <DialogDescription>Work progress counts linked top-level backlog items by current student assignee. Milestone acceptance is handled separately.</DialogDescription></DialogHeader>
    {!row.canViewMemberProgress?<p role="alert">Your permission to view member progress is unavailable or has changed.</p>
      :!row.progress.configured?<p>Link backlog items to this milestone before viewing member progress.</p>:<>
        <div className="flex flex-wrap gap-2 text-sm"><Badge variant="outline">Milestone work progress: {row.progress.percentage}% · {row.progress.done}/{row.progress.total} Done</Badge></div>
        {!members.length?<p>No current student members belong to this team.</p>:<Table><TableHeader><TableRow>
          <TableHead>Student</TableHead><TableHead>Project role</TableHead><TableHead>Assigned</TableHead><TableHead>Done</TableHead><TableHead>Work progress</TableHead>
        </TableRow></TableHeader><TableBody>{members.map(member=><TableRow key={member.userId}>
          <TableCell><p className="font-medium">{member.displayName}</p><p className="text-xs text-muted-foreground">{member.userCode??"No member code"}</p></TableCell>
          <TableCell>{member.projectRole??"Unassigned role"}</TableCell><TableCell>{member.assigned}</TableCell><TableCell>{member.done}</TableCell>
          <TableCell>{member.percentage==null?<span className="text-xs text-muted-foreground">No assigned backlog items</span>:`${member.percentage}%`}</TableCell>
        </TableRow>)}</TableBody></Table>}
        {(row.workWithoutCurrentStudent??0)>0&&<p className="rounded border p-3 text-sm">{row.workWithoutCurrentStudent} linked item(s) have no current student assignee. These items still count toward the milestone's total work.</p>}
        <p className="text-xs text-muted-foreground">Individual progress = Done assigned items / all assigned items in this milestone × 100. Refresh Alerts after assignments or statuses change.</p>
      </>}
  </DialogContent></Dialog>;
}
