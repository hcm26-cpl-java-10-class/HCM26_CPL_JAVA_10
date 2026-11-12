export const workLabels: Record<string, string> = { TODO: "Todo", IN_PROGRESS: "In progress", REVIEW: "Review", DONE: "Done" };
export const deliveryLabels: Record<string, string> = {
  PLANNED: "Chưa bắt đầu", IN_PROGRESS: "Đang thực hiện", DRAFT: "Bản nháp", SUBMITTED: "Chờ duyệt",
  ACCEPTED: "Đã chấp nhận", CHANGES_REQUESTED: "Cần chỉnh sửa", REJECTED: "Bị từ chối", WAIVED: "Được miễn",
};
export function activityLabel(value: string) {
  const labels: Record<string, string> = {
    TASK_CREATED: "Tạo công việc", TASK_UPDATED: "Cập nhật công việc", TASK_UPDATE: "Cập nhật công việc",
    TASK_STATUS_CHANGED: "Đổi trạng thái công việc", TASK_UPDATE_STATUS: "Đổi trạng thái công việc",
    TASK_DELETED: "Xóa công việc", TASK_DELETE: "Xóa công việc", TASK_ASSIGNED: "Phân công công việc",
    TASK_MOVED_TO_SPRINT: "Chuyển công việc vào Sprint", TASK_REORDERED: "Sắp xếp công việc",
    BACKLOG_CREATE: "Tạo backlog", BACKLOG_CREATED: "Tạo backlog", BACKLOG_UPDATE: "Cập nhật backlog", BACKLOG_UPDATED: "Cập nhật backlog",
    BACKLOG_DELETE: "Xóa backlog", BACKLOG_DELETED: "Xóa backlog", BACKLOG_STATUS_CHANGED: "Đổi trạng thái backlog", BACKLOG_STATUS_UPDATED: "Đổi trạng thái backlog",
    SUBMISSION_SUBMITTED: "Nộp bài", SUBMISSION_ACCEPT: "Chấp nhận bài nộp", SUBMISSION_REJECT: "Từ chối bài nộp",
    SUBMISSION_REQUEST_CHANGES: "Yêu cầu chỉnh sửa", MILESTONE_CREATED: "Tạo milestone", MILESTONE_STARTED: "Bắt đầu milestone",
    MILESTONE_AT_RISK_ALERT_SENT: "Gửi cảnh báo milestone", MILESTONE_ACCEPTED: "Chấp nhận milestone",
    MILESTONE_REJECTED: "Từ chối milestone", MILESTONE_CHANGES_REQUESTED: "Yêu cầu sửa milestone",
  };
  return labels[value] ?? "Cập nhật " + (value.startsWith("MILESTONE_") ? "milestone" : value.startsWith("SUBMISSION_") ? "bài nộp" : "công việc");
}
