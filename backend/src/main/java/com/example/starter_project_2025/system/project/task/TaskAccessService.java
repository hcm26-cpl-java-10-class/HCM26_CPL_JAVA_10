package com.example.starter_project_2025.system.project.task;

import com.example.starter_project_2025.security.UserPrincipal;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.AuthenticationCredentialsNotFoundException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;

import java.util.Objects;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class TaskAccessService {
    private final ObjectProvider<TaskProjectAccess> projectAccessProvider;

    public Long requirePermission(String permission) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)
                || principal.getUser().getId() == null) {
            throw new AuthenticationCredentialsNotFoundException("Please sign in");
        }
        if (authentication.getAuthorities().stream().noneMatch(a -> permission.equals(a.getAuthority()))) {
            throw new AccessDeniedException("You do not have permission to perform task actions");
        }
        return principal.getUser().getId();
    }

    public void checkProject(UUID projectId, Long actorId) {
        TaskProjectAccess access = projectAccessProvider.getIfAvailable();
        if (access != null && !access.findProjectIds(actorId).contains(projectId)) {
            throw new AccessDeniedException("You are not a member of this project");
        }
    }

    public void checkAssignee(UUID projectId, UUID memberId) {
        TaskProjectAccess access = projectAccessProvider.getIfAvailable();
        if (memberId != null && access != null && access.findMemberUserId(projectId, memberId).isEmpty()) {
            throw new TaskValidationException("assigneeProjectMemberId", "The assignee must be a member of this project");
        }
    }

    public Long creatorFilter(UUID projectId, Long actorId) {
        checkProject(projectId, actorId);
        return projectAccessProvider.getIfAvailable() == null ? actorId : null;
    }

    public void checkRead(Task task, Long actorId) {
        checkProject(task.getProjectId(), actorId);
        if (projectAccessProvider.getIfAvailable() == null && !Objects.equals(task.getCreatedBy(), actorId)) {
            throw new AccessDeniedException("You do not have permission to view this task");
        }
    }

    public void checkUpdate(Task task, Long actorId) {
        checkRead(task, actorId);
        if (!canUpdate(task, actorId)) {
            throw new AccessDeniedException("Only the assignee or project leader/mentor can edit this task");
        }
    }

    public boolean canUpdate(Task task, Long actorId) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities().stream()
                .noneMatch(authority -> "TASK_UPDATE".equals(authority.getAuthority()))) {
            return false;
        }
        TaskProjectAccess access = projectAccessProvider.getIfAvailable();
        if (access != null && !access.findProjectIds(actorId).contains(task.getProjectId())) {
            return false;
        }
        return (task.getAssigneeProjectMemberId() == null && Objects.equals(task.getCreatedBy(), actorId))
                || (access != null && (access.isManager(task.getProjectId(), actorId)
                || (task.getAssigneeProjectMemberId() != null && access
                .findMemberUserId(task.getProjectId(), task.getAssigneeProjectMemberId())
                .filter(actorId::equals).isPresent())));
    }

    public void checkDelete(Task task, Long actorId) {
        checkRead(task, actorId);
        if (!canDelete(task, actorId)) {
            throw new AccessDeniedException("Only the project leader/mentor can delete tasks");
        }
    }

    public boolean canDelete(Task task, Long actorId) {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities().stream()
                .noneMatch(authority -> "TASK_DELETE".equals(authority.getAuthority()))) {
            return false;
        }
        TaskProjectAccess access = projectAccessProvider.getIfAvailable();
        return access != null && access.findProjectIds(actorId).contains(task.getProjectId())
                && access.isManager(task.getProjectId(), actorId);
    }
}
