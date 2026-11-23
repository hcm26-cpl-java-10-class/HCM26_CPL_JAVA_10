package com.example.starter_project_2025.system.project.analytics;

import java.time.LocalDate;
import java.util.List;

/**
 * US-ANL-008: payload of the click-to-drill-down drawer.
 *
 * <p>Lists the exact work items behind a clicked bar segment or line marker
 * while honouring the caller's project scope and active analytics filters.</p>
 */
public record ProjectAnalyticsDrillDownResponse(
        Long projectId,
        String projectCode,
        String chart,
        LocalDate date,
        String series,
        int totalCount,
        List<WorkItem> items
) {

    /**
     * One work item (backlog item or subtask) shown inside the drill-down drawer.
     *
     * @param id            stable row key (numeric backlog id or subtask UUID)
     * @param backlogItemId backlog item id opened by the task detail sheet
     *                      (the parent backlog item for subtasks)
     * @param taskCode      human readable code, e.g. {@code PRJ-12}
     * @param workType      {@code STORY}, {@code SUBTASK}, {@code TASK} or {@code BUG}
     * @param status        current workflow status
     * @param assigneeName  resolved assignee display name, or {@code null}
     * @param cycleDays     active execution days rounded to 1 decimal, or {@code null}
     * @param leadDays      end-to-end lead days rounded to 1 decimal, or {@code null}
     */
    public record WorkItem(
            String id,
            Long backlogItemId,
            String taskCode,
            String title,
            String workType,
            String status,
            String assigneeName,
            Long sprintId,
            String sprintName,
            LocalDate createdDate,
            LocalDate completedDate,
            Double cycleDays,
            Double leadDays
    ) { }
}
