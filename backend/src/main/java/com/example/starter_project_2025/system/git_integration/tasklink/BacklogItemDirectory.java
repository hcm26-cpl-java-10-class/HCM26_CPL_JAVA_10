package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.service.GitIntegrationAccessService;
import com.example.starter_project_2025.system.project.template.service.assignment.AssignedProjectAccess;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * SY-05: what Git Integration needs to know about backlog items (tasks), read-only.
 * Read access follows the backlog module's own rule ({@code GET /api/sprint-backlogs/{id}}):
 * whoever can open a task in its workspace sees its commits, without needing the Git
 * Integration permission. A task the caller cannot see is reported as not found.
 */
@Component
@RequiredArgsConstructor
public class BacklogItemDirectory {

    /** Same permission as reading a backlog item ({@code SprintBacklog} resource, READ). */
    static final String BACKLOG_READ = "SPRINT_BACKLOG_READ";

    private final GitBacklogLookupRepository backlog;
    private final WorkspaceRepository workspaces;
    private final AssignedProjectAccess projectAccess;
    private final GitIntegrationAccessService access;

    public Map<String, BacklogItemRow> byKeys(Long tenantId, Collection<String> keys) {
        if (keys.isEmpty()) return Map.of();
        return backlog.findByKeys(tenantId, keys).stream()
                .collect(Collectors.toMap(BacklogItemRow::getTaskKey, Function.identity(), (first, ignored) -> first));
    }

    public Map<Long, BacklogItemRow> byIds(Collection<Long> ids) {
        if (ids.isEmpty()) return Map.of();
        return backlog.findByIds(ids).stream().collect(Collectors.toMap(BacklogItemRow::getId, Function.identity()));
    }

    /** The project a task belongs to: its own, or for a team-only task the project of its team's workspace. */
    public Long projectOf(BacklogItemRow item) {
        if (item.getProjectId() != null || item.getSprintTeamId() == null) return item.getProjectId();
        return workspaces.findCurrentByTeamId(item.getSprintTeamId())
                .map(workspace -> workspace.getProject() == null ? null : workspace.getProject().getId())
                .orElse(null);
    }

    /** The task when the caller may open it; 404 otherwise (no leak of tasks of other teams or tenants). */
    public BacklogItemRow requireReadable(Long itemId) {
        requireBacklogRead();
        User user = access.requireUser();
        BacklogItemRow item = itemId == null ? null : byIds(Set.of(itemId)).get(itemId);
        if (item == null || !readable(user, item, new HashMap<>())) throw GitIntegrationException.backlogItemNotFound();
        return item;
    }

    /** The subset of the given tasks the caller may open. */
    public Set<Long> readable(Collection<Long> itemIds) {
        requireBacklogRead();
        User user = access.requireUser();
        Map<Long, Boolean> projectChecks = new HashMap<>();
        Set<Long> visible = new LinkedHashSet<>();
        for (BacklogItemRow item : byIds(itemIds).values()) {
            if (readable(user, item, projectChecks)) visible.add(item.getId());
        }
        return visible;
    }

    private static void requireBacklogRead() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities().stream()
                .noneMatch(authority -> BACKLOG_READ.equals(authority.getAuthority()))) {
            throw new AccessDeniedException("Reading backlog items is not allowed");
        }
    }

    private boolean readable(User user, BacklogItemRow item, Map<Long, Boolean> projectChecks) {
        Long tenantId = user.getTenant() == null ? user.getTenantId() : user.getTenant().getId();
        if (item.getTenantId() != null && !Objects.equals(item.getTenantId(), tenantId)) return false;
        if (item.getProjectId() == null) return true;
        return projectChecks.computeIfAbsent(item.getProjectId(), projectId -> {
            try {
                projectAccess.requireProject(projectId, false);
                return true;
            } catch (AccessDeniedException denied) {
                return false;
            }
        });
    }
}
