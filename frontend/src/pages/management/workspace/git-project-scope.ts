import { createContext, useContext } from "react";
import type { WorkspaceAssignmentContext, WorkspaceProjectNode } from "@/types/features/project-assignment";
import { useGitActivityParam } from "./git-activity-url-context";

export interface GitProjectOption {
  id: number;
  name: string;
  /** An unassigned Master represents the union of the Team's allowed modules. */
  queryProjectId?: number;
}

export interface GitProjectScope {
  projects: GitProjectOption[];
  defaultProjectId: number;
}

export function gitProjectScope(context: WorkspaceAssignmentContext | undefined, fallbackId: number): GitProjectScope {
  const flatten = (nodes: WorkspaceProjectNode[]): WorkspaceProjectNode[] => nodes.flatMap(node => [node, ...flatten(node.children)]);
  const nodes = flatten(context?.projects ?? []);
  const assigned = nodes.filter(node => node.assigned);
  const master = nodes.find(node => node.parentProjectId == null);
  const aggregate = master && (master.assigned || assigned.length > 1);
  const projects: GitProjectOption[] = aggregate
    ? [{ id: master.id, name: master.name, queryProjectId: master.assigned ? master.id : undefined },
      ...assigned.filter(node => node.id !== master.id).map(node => ({ id: node.id, name: node.name, queryProjectId: node.id }))]
    : assigned.map(node => ({ id: node.id, name: node.name, queryProjectId: node.id }));
  if (!projects.length) projects.push({ id: fallbackId, name: `Project #${fallbackId}`, queryProjectId: fallbackId });
  return { projects, defaultProjectId: projects[0].id };
}

export const GitProjectScopeContext = createContext<GitProjectScope | null>(null);

export function useGitProjectFilter(key: string) {
  const scope = useContext(GitProjectScopeContext);
  if (!scope) throw new Error("Git Activity Project scope is missing");
  const [stored, setStored] = useGitActivityParam<number | undefined>(key, scope.defaultProjectId, "number");
  const selected = scope.projects.find(project => project.id === stored) ?? scope.projects[0];
  return { projects: scope.projects, selectedId: selected.id, projectId: selected.queryProjectId,
    setProjectId: (id: number) => { if (scope.projects.some(project => project.id === id)) setStored(id); } };
}
