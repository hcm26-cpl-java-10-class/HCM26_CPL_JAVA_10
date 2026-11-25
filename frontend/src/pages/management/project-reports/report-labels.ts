export const workLabels: Record<string, string> = { TODO: "Todo", IN_PROGRESS: "In progress", REVIEW: "Review", DONE: "Done" };
export const deliveryLabels: Record<string, string> = {
  PLANNED: "Not started", IN_PROGRESS: "In progress", DRAFT: "Draft", SUBMITTED: "Pending review",
  ACCEPTED: "Accepted", CHANGES_REQUESTED: "Changes requested", REJECTED: "Rejected", WAIVED: "Waived",
};
export function activityLabel(value: string) {
  const labels: Record<string, string> = {
    TASK_CREATED: "Created work item", TASK_UPDATED: "Updated work item", TASK_UPDATE: "Updated work item",
    TASK_STATUS_CHANGED: "Changed work item status", TASK_UPDATE_STATUS: "Changed work item status",
    TASK_DELETED: "Deleted work item", TASK_DELETE: "Deleted work item", TASK_ASSIGNED: "Assigned work item",
    TASK_MOVED_TO_SPRINT: "Moved work item to sprint", TASK_REORDERED: "Reordered work item",
    BACKLOG_CREATE: "Created backlog item", BACKLOG_CREATED: "Created backlog item", BACKLOG_UPDATE: "Updated backlog item", BACKLOG_UPDATED: "Updated backlog item",
    BACKLOG_DELETE: "Deleted backlog item", BACKLOG_DELETED: "Deleted backlog item", BACKLOG_STATUS_CHANGED: "Changed backlog status", BACKLOG_STATUS_UPDATED: "Changed backlog status",
    SUBMISSION_SUBMITTED: "Submitted work", SUBMISSION_ACCEPT: "Accepted submission", SUBMISSION_REJECT: "Rejected submission",
    SUBMISSION_REQUEST_CHANGES: "Requested changes", MILESTONE_CREATED: "Created milestone", MILESTONE_STARTED: "Started milestone",
    MILESTONE_AT_RISK_ALERT_SENT: "Sent milestone alert", MILESTONE_ACCEPTED: "Accepted milestone",
    MILESTONE_REJECTED: "Rejected milestone", MILESTONE_CHANGES_REQUESTED: "Requested milestone changes",
  };
  return labels[value] ?? "Updated " + (value.startsWith("MILESTONE_") ? "milestone" : value.startsWith("SUBMISSION_") ? "submission" : "work item");
}
