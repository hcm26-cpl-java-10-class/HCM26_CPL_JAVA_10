package com.example.starter_project_2025.system.project.resources.workspace_resources;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.AccessLevel;
import lombok.RequiredArgsConstructor;
import lombok.experimental.FieldDefaults;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Component;

import java.util.Set;

/**
 * Write-side RBAC of the workspace resource tab (US-RES-003 business rule 1).
 * <p>
 * Only the mentor in charge of the team or an administrator / program manager
 * may add, edit or delete resources. Being able to read the workspace is
 * deliberately <em>not</em> enough: a trainee or a teacher of another team
 * must never change this team's resource list.
 */
@Component
@RequiredArgsConstructor
@FieldDefaults(level = AccessLevel.PRIVATE, makeFinal = true)
public class WorkspaceResourceEditorPolicy {

    /** Roles that own the programme and may edit any team. */
    private static final Set<String> ADMIN_ROLES = Set.of(
            "SUPER_ADMIN", "ADMIN", "PO", "PM", "PROGRAM_MANAGER"
    );

    public boolean canManage(User user, Workspace workspace) {

        if (user == null || workspace == null || workspace.getTeam() == null) {
            return false;
        }

        if (hasAdminRole(user)) {
            return true;
        }

        ProjectTeam team = workspace.getTeam();
        Long userId = user.getId();

        if (userId != null && userId.equals(team.getAssignedMentorId())) {
            return true;
        }

        // A team without an explicit mentor inherits the class mentor.
        Long classMentorId = team.getTrainingClass() == null
                ? null
                : team.getTrainingClass().getMentorId();

        return team.getAssignedMentorId() == null && userId != null && userId.equals(classMentorId);
    }

    public void requireManage(User user, Workspace workspace) {

        if (!canManage(user, workspace)) {
            throw new AccessDeniedException(
                    "Only the mentor in charge of this team or an administrator/program manager can change its resources");
        }
    }

    private boolean hasAdminRole(User user) {

        return user.getRoles() != null && user.getRoles().stream()
                .filter(role -> Boolean.TRUE.equals(role.getIsActive()))
                .map(role -> role.getName())
                .anyMatch(ADMIN_ROLES::contains);
    }
}
