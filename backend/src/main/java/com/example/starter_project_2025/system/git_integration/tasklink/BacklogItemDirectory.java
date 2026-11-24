package com.example.starter_project_2025.system.git_integration.tasklink;

import com.example.starter_project_2025.system.git_integration.exception.GitIntegrationException;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository;
import com.example.starter_project_2025.system.git_integration.repository.GitBacklogLookupRepository.BacklogItemRow;
import com.example.starter_project_2025.system.git_integration.service.GitIntegrationAccessService;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.template.service.assignment.AssignedProjectAccess;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import java.util.Collection;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

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
    /** TM-03: linking / unlinking a pull request changes the task's metadata ({@code SprintBacklog}, UPDATE). */
    static final String BACKLOG_UPDATE = "SPRINT_BACKLOG_UPDATE";

    private final GitBacklogLookupRepository backlog;
    private final WorkspaceRepository workspaces;
    private final AssignedProjectAccess projectAccess;
    private final GitIntegrationAccessService access;
    private final ProjectRepository projects;
    private final com.example.starter_project_2025.system.project.sprint_backlog.key.BacklogTaskKeyService taskKeys;

    public Set<String> prefixesOf(Long tenantId) {
        Set<String> prefixes = new LinkedHashSet<>(taskKeys.prefixesOf(tenantId));
        workspaces.findAllByTenant_IdAndStatusAndIsActiveTrue(tenantId,
                com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus.ACTIVE).stream()
                .map(workspace -> workspace.getTaskKeyPrefix()).filter(prefix -> prefix != null && !prefix.isBlank())
                .map(prefix -> prefix.trim().toUpperCase(java.util.Locale.ROOT)).forEach(prefixes::add);
        projects.findByTenantIdAndIsActiveTrue(tenantId).stream().map(project -> project.getName())
                .filter(java.util.Objects::nonNull).map(name -> java.util.Arrays.stream(name.split("[^A-Za-z0-9]+"))
                        .filter(token -> !token.isBlank() && !token.matches("\\d+"))
                        .map(token -> token.substring(0, 1)).collect(Collectors.joining()))
                .filter(prefix -> prefix.length() >= 2)
                .map(prefix -> prefix.substring(0, Math.min(10, prefix.length())).toUpperCase(java.util.Locale.ROOT)).forEach(prefixes::add);
        return prefixes;
    }

    public Map<String, BacklogItemRow> byKeys(Long tenantId, Collection<String> keys) {
        if (keys.isEmpty()) return Map.of();
        Map<String, BacklogItemRow> found = backlog.findByKeys(tenantId, keys).stream()
                .collect(Collectors.toMap(BacklogItemRow::getTaskKey, Function.identity(), (first, ignored) -> first));
        Map<String, Long> aliases = new HashMap<>();
        for (String key : keys) {
            if (found.containsKey(key) || !key.matches("(?i)[A-Z0-9]{1,10}-[1-9][0-9]{0,18}")) continue;
            try { aliases.put(key, Long.valueOf(key.substring(key.lastIndexOf('-') + 1))); }
            catch (NumberFormatException ignored) { /* Outside Long range: an invalid Task reference. */ }
        }
        Map<Long, BacklogItemRow> candidates = byIds(aliases.values());
        aliases.forEach((key, id) -> {
            BacklogItemRow item = candidates.get(id);
            if (item == null || !key.regionMatches(true, 0, "TASK-", 0, 5) && item.getTaskKey() != null) return;
            Long itemTenant = item.getTenantId();
            if (itemTenant == null) itemTenant = projects.findById(directoryProject(item))
                    .map(project -> project.getTenantId()).orElse(null);
            if (Objects.equals(tenantId, itemTenant)) found.put(key, item);
        });
        return found;
    }

    private Long directoryProject(BacklogItemRow item) {
        Long projectId = projectOf(item);
        // JpaRepository.findById does not accept null.
        return projectId == null ? -1L : projectId;
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

    /** TM-03: the task when the caller may open and update it; 403 without the permission, 404 when not visible. */
    public BacklogItemRow requireUpdatable(Long itemId) {
        requireAuthority(BACKLOG_UPDATE, "Updating backlog items is not allowed");
        return requireReadable(itemId);
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
        requireAuthority(BACKLOG_READ, "Reading backlog items is not allowed");
    }

    private static void requireAuthority(String permission, String message) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities().stream()
                .noneMatch(authority -> permission.equals(authority.getAuthority()))) {
            throw new AccessDeniedException(message);
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
