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
            throw new AuthenticationCredentialsNotFoundException("Vui lòng đăng nhập");
        }
        if (authentication.getAuthorities().stream().noneMatch(a -> permission.equals(a.getAuthority()))) {
            throw new AccessDeniedException("Bạn không có quyền thực hiện thao tác Task");
        }
        return principal.getUser().getId();
    }

    public void checkProject(UUID projectId, Long actorId) {
        TaskProjectAccess access = projectAccessProvider.getIfAvailable();
        if (access != null && !access.findProjectIds(actorId).contains(projectId)) {
            throw new AccessDeniedException("Bạn không thuộc Project này");
        }
    }

    public void checkAssignee(UUID projectId, UUID memberId) {
        TaskProjectAccess access = projectAccessProvider.getIfAvailable();
        if (memberId != null && access != null && access.findMemberUserId(projectId, memberId).isEmpty()) {
            throw new TaskValidationException("assigneeProjectMemberId", "Assignee phải là thành viên của Project");
        }
    }

    public Long creatorFilter(UUID projectId, Long actorId) {
        checkProject(projectId, actorId);
        return projectAccessProvider.getIfAvailable() == null ? actorId : null;
    }

    public void checkRead(Task task, Long actorId) {
        checkProject(task.getProjectId(), actorId);
        if (projectAccessProvider.getIfAvailable() == null && !Objects.equals(task.getCreatedBy(), actorId)) {
            throw new AccessDeniedException("Bạn không có quyền xem Task này");
        }
    }

    public void checkUpdate(Task task, Long actorId) {
        checkRead(task, actorId);
        if (!canUpdate(task, actorId)) {
            throw new AccessDeniedException("Chỉ người được giao Task hoặc Leader/Mentor được sửa Task");
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
}
