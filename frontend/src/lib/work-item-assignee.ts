interface AssignedWorkItem {
  assigneeProjectMemberId?: number | null;
  assigneeDisplayName?: string | null;
}

export interface WorkItemAssigneeOption {
  projectMemberId: number;
  displayName: string;
  disabled?: boolean;
}

export function workItemAssigneeLabel(item: AssignedWorkItem, members: WorkItemAssigneeOption[] = []) {
  if (item.assigneeProjectMemberId == null) return "Unassigned";
  return members.find(member => member.projectMemberId === item.assigneeProjectMemberId)?.displayName
    || item.assigneeDisplayName?.trim()
    || `Member #${item.assigneeProjectMemberId}`;
}

// A select with a stored value absent from its options visually falls back to
// its first option. Keep unavailable assignees visible without offering them
// for a new assignment; clearing or choosing an active member remains possible.
export function workItemAssigneeOptions(item: AssignedWorkItem, members: WorkItemAssigneeOption[]) {
  const id = item.assigneeProjectMemberId;
  if (id == null || members.some(member => member.projectMemberId === id)) return members;
  return [...members, { projectMemberId: id, displayName: `${workItemAssigneeLabel(item)} (unavailable)`, disabled: true }];
}
