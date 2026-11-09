package com.example.starter_project_2025.system.project.sprint_backlog;

/**
 * Member of the team that owns the workspace, offered by the assignee picker
 * of the backlog create bar.
 * <p>
 * {@code id} is the {@code project_members.id} value written back through
 * {@link SprintBacklogDTO#getAssigneeProjectMemberId()}, so the backlog module
 * does not expose the whole member payload only to let the student pick a
 * person.
 *
 * @param id       project member id (assigneeProjectMemberId)
 * @param userId   user behind the project member
 * @param fullName display name of the member
 * @param userCode student / staff code of the member
 * @param role     canonical team role list (for example {@code "PM,BA"})
 */
public record BacklogAssigneeOptionDTO(
        Long id,
        Long userId,
        String fullName,
        String userCode,
        String role
) {
}
