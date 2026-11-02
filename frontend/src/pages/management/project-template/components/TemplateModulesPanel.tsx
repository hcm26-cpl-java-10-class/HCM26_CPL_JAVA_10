import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { FolderTree, Plus } from "lucide-react";
import axiosInstance from "@/api/axios";
import { usePermissions } from "@/hooks/usePermissions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { ProjectTemplateStatus } from "@/types/features/project-template";
import { ProjectTemplateError, ProjectTemplateLoading } from "./ProjectTemplateState";
import { ProjectTemplateStatusBadge } from "./ProjectTemplateStatusBadge";

interface TemplateNode {
  id: number;
  parentTemplateId: number | null;
  code: string;
  name: string;
  status: ProjectTemplateStatus;
  templateVersion: number;
  versionId: number | null;
  modules: TemplateNode[];
}

function ModuleNode({ node, canCreate, historical }: { node: TemplateNode; canCreate: boolean; historical: boolean }) {
  const url = historical && node.versionId ? `/project-templates/${node.id}/detail?tab=versions&version=${node.versionId}`
    : `/project-templates/${node.id}/detail`;
  return <li className="min-w-0 space-y-3">
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border bg-card p-4">
      <div className="min-w-0 space-y-1"><Link to={url} className="break-words text-sm font-semibold hover:underline">{node.name}</Link>
        <p className="break-words text-xs text-muted-foreground">{node.code} · Version {node.templateVersion}</p></div>
      <div className="flex flex-wrap items-center gap-2"><ProjectTemplateStatusBadge status={node.status} />
        {canCreate && node.status !== "ARCHIVED" && <Button variant="outline" size="sm" asChild>
          <Link to={`/project-templates/create?parentTemplateId=${node.id}`}><Plus />Add module</Link></Button>}</div>
    </div>
    {node.modules.length > 0 && <ul className="ml-3 space-y-3 border-l pl-3 sm:ml-5 sm:pl-5">
      {node.modules.map(child => <ModuleNode key={child.id} node={child} canCreate={canCreate} historical={historical} />)}
    </ul>}
  </li>;
}

export function TemplateModulesPanel({ templateId, canCreate, versionId, historical = false }: {
  templateId: number; canCreate: boolean; versionId?: number; historical?: boolean;
}) {
  const { user, activeRole } = usePermissions();
  const query = useQuery({ queryKey: ["project-templates", user.email, activeRole, "hierarchy", templateId, versionId],
    queryFn: async ({ signal }) => (await axiosInstance.get<TemplateNode>(`/project-templates/${templateId}/hierarchy`,
      { params: { versionId }, signal })).data, retry: false, refetchOnWindowFocus: false });
  if (query.isLoading) return <ProjectTemplateLoading />;
  if (query.isError) return <ProjectTemplateError error={query.error} onRetry={() => void query.refetch()} />;
  if (!query.data) return null;
  return <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3">
    <CardTitle className="flex items-center gap-2"><FolderTree className="size-5" />Modules</CardTitle>
    {canCreate && <Button variant="outline" asChild><Link to={`/project-templates/create?parentTemplateId=${templateId}`}>
      <Plus />Add module</Link></Button>}</div>
    <CardDescription>Each module has its own overview, team constraints, milestones, rubric, resources and versions.</CardDescription>
  </CardHeader><CardContent>{!query.data.modules.length ? <p className="text-sm text-muted-foreground">No child modules configured.</p>
    : <ul className="space-y-3" aria-label="Template module tree">{query.data.modules.map(node =>
      <ModuleNode key={node.id} node={node} canCreate={canCreate} historical={historical} />)}</ul>}</CardContent></Card>;
}
