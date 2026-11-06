import { Link } from "react-router-dom";
import { useState } from "react";
import { ChevronDown, ChevronRight, FolderTree, History } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { WorkspaceAssignmentContext, WorkspaceProjectNode } from "@/types/features/project-assignment";

export function flattenWorkspaceProjects(nodes: WorkspaceProjectNode[]): WorkspaceProjectNode[] {
  return nodes.flatMap(node => [node, ...flattenWorkspaceProjects(node.children)]);
}

function ProjectNode({ node, selectedId, onSelect }: { node: WorkspaceProjectNode; selectedId?: number | null; onSelect: (id: number) => void }) {
  const [expanded, setExpanded] = useState(false);
  return <Collapsible asChild open={expanded} onOpenChange={setExpanded}><li className="space-y-2"><div className={`flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 ${selectedId === node.id ? "border-primary bg-primary/5" : ""}`}>
    <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium">{node.name}</p>
      <Badge variant="secondary">{node.parentProjectId == null ? "Master" : "Module"}</Badge></div><p className="text-xs text-muted-foreground">{node.code}</p></div>
    <div className="flex flex-wrap items-center gap-2"><Badge variant="outline">{node.status}</Badge>
      {node.children.length > 0 && <CollapsibleTrigger asChild><Button type="button" size="sm" variant="outline"
        aria-label={`${expanded ? "Hide" : "Show"} modules for ${node.name}`}>
        {expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        {expanded ? "Hide modules" : "Show modules"} ({node.children.length})
      </Button></CollapsibleTrigger>}
      {node.assigned && <Button type="button" size="sm" variant={selectedId === node.id ? "secondary" : "outline"} onClick={() => onSelect(node.id)}>
        {selectedId === node.id ? "Selected" : "Open project"}</Button>}</div>
  </div>{node.children.length > 0 && <CollapsibleContent asChild><ul className="space-y-2 border-l pl-4">{node.children.map(child =>
    <ProjectNode key={child.id} node={child} selectedId={selectedId} onSelect={onSelect} />)}</ul></CollapsibleContent>}</li></Collapsible>;
}

export function WorkspaceProjectHierarchy({ data, selectedId, onSelect }: {
  data: WorkspaceAssignmentContext; selectedId?: number | null; onSelect: (id: number) => void;
}) {
  return <>
    {data.readOnly && <p role="status" className="rounded-lg border bg-muted/30 p-4 text-sm">This is a previous workspace. Its project brief, resources and work history are available for viewing.</p>}
    {data.assignmentId !== null && <Card><CardHeader><CardTitle className="flex items-center gap-2"><FolderTree className="size-5" />Project hierarchy</CardTitle>
      <p className="text-sm text-muted-foreground">{data.mode === "WHOLE" ? "Your team owns the complete master project." : "Your team works on its assigned module. Shared master milestones are visible to every assigned team and managed by class mentors."}
        {data.assignedAt && ` Assigned ${new Date(data.assignedAt).toLocaleString("en-GB")}.`}</p></CardHeader>
      <CardContent><ul className="space-y-2">{data.projects.map(node => <ProjectNode key={node.id} node={node} selectedId={selectedId} onSelect={onSelect} />)}</ul></CardContent></Card>}
    {data.history.length > 1 && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><History className="size-4" />Workspace history</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap gap-2">{data.history.map(workspace => <Button key={workspace.workspaceId} asChild size="sm" variant={workspace.workspaceId === data.workspaceId ? "secondary" : "outline"}>
        <Link to={`/management/workspaces/${workspace.workspaceId}`}>{workspace.name}{workspace.current ? " · Current" : " · Previous"}</Link></Button>)}</CardContent></Card>}
  </>;
}
