package com.example.starter_project_2025.system.project.workspace.git;

import com.example.starter_project_2025.system.project.ProjectMemberRole;
import com.example.starter_project_2025.system.project.workspace.controller.WorkspaceCorrelation;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceAudit;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceAuditRepository;
import com.example.starter_project_2025.system.project.workspace.service.*;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class WorkspaceGitService {
    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceRosterService roster;
    private final ProjectGitConfigRepository configs;
    private final WorkspaceAuditRepository audits;
    private final UserRepository users;
    private final GitRepositoryValidator validator;
    private final ObjectMapper json;
    private final EntityManager entities;

    private record Scope(User actor, Workspace workspace, boolean canEdit) { }

    private Scope scope(Long workspaceId) {
        User actor = access.requireUser(false);
        Workspace workspace = contexts.require(actor, workspaceId);
        var membership = roster.current(workspace.getTeam()).stream()
                .filter(m -> Objects.equals(m.getClassMember().getUser().getId(), actor.getId())).findFirst();
        boolean mentor = Objects.equals(workspace.getTeam().getAssignedMentorId(), actor.getId());
        if (membership.isEmpty() && !mentor) throw new AccessDeniedException("Git repository is outside your team scope");
        boolean canEdit = mentor || membership.map(m -> ProjectMemberRole.hasRole(m.getRole(), "PM")
                || access.permitted(actor, "WORKSPACE_UPDATE")).orElse(false);
        return new Scope(actor, workspace, canEdit);
    }

    public GitConfigDtos.View get(Long workspaceId) {
        Scope scope = scope(workspaceId);
        return view(scope, current(scope));
    }

    @Transactional
    public GitConfigDtos.View save(Long workspaceId, GitConfigDtos.Save request) {
        Scope scope = writable(workspaceId);
        var input = validator.validate(request);
        ProjectGitConfig row = current(scope);
        checkVersion(row, request.version());
        if (row != null && Objects.equals(row.getRepositoryUrl(), input.cloneUrl())
                && Objects.equals(row.getRepositoryWebUrl(), input.webUrl()) && Objects.equals(row.getDefaultBranch(), input.branch()))
            return view(scope, row); // A retry/no-op does not create a misleading audit entry.
        Map<String, Object> before = state(row);
        String action = row == null || row.getRepositoryUrl() == null ? "GIT_REPO_LINKED" : "GIT_REPO_UPDATED";
        Instant now = Instant.now();
        if (row == null) {
            row = new ProjectGitConfig(); row.setWorkspaceId(workspaceId); row.setWorkspace(scope.workspace());
            row.setTenantId(scope.workspace().getTenant().getId()); row.setTeamId(scope.workspace().getTeam().getId());
            row.setCreatedAt(now); row.setCreatedBy(scope.actor().getId());
        }
        row.setRepositoryUrl(input.cloneUrl()); row.setRepositoryWebUrl(input.webUrl());
        row.setDefaultBranch(input.branch()); row.setProvider(input.provider());
        row.setVersion(row.getVersion() + 1); row.setUpdatedAt(now); row.setUpdatedBy(scope.actor().getId());
        configs.saveAndFlush(row);
        audit(scope, action, before, state(row));
        return view(scope, row);
    }

    @Transactional
    public GitConfigDtos.View unlink(Long workspaceId, long version) {
        Scope scope = writable(workspaceId);
        ProjectGitConfig row = current(scope);
        checkVersion(row, version);
        if (row == null || row.getRepositoryUrl() == null) return view(scope, row);
        Map<String, Object> before = state(row);
        row.setRepositoryUrl(null); row.setRepositoryWebUrl(null); row.setProvider(null); row.setDefaultBranch(null);
        row.setVersion(row.getVersion() + 1); row.setUpdatedAt(Instant.now()); row.setUpdatedBy(scope.actor().getId());
        configs.saveAndFlush(row);
        audit(scope, "GIT_REPO_UNLINKED", before, state(row));
        return view(scope, row);
    }

    private Scope writable(Long id) {
        Scope scope = scope(id);
        if (!scope.canEdit()) throw new AccessDeniedException("Only the team leader, an authorized workspace editor or assigned mentor can change the repository");
        // Lock the parent even when no config exists yet: concurrent first saves cannot both succeed.
        entities.lock(scope.workspace(), LockModeType.PESSIMISTIC_WRITE);
        return scope;
    }
    private ProjectGitConfig current(Scope scope) {
        ProjectGitConfig row = configs.findById(scope.workspace().getId()).orElse(null);
        if (row != null && (!Objects.equals(row.getTenantId(), scope.workspace().getTenant().getId())
                || !Objects.equals(row.getTeamId(), scope.workspace().getTeam().getId())))
            throw new AccessDeniedException("Repository ownership does not match this workspace");
        return row;
    }
    private void checkVersion(ProjectGitConfig row, Long expected) {
        if (expected == null || expected < 0) throw new GitConfigValidationException("version", "Reload the repository configuration before saving.");
        if (expected != (row == null ? 0 : row.getVersion()))
            throw new ResponseStatusException(HttpStatus.CONFLICT, "The repository was changed by another user. Reload before saving again.");
    }
    private GitConfigDtos.View view(Scope scope, ProjectGitConfig row) {
        boolean configured = row != null && row.getRepositoryUrl() != null;
        String actorName = row == null ? null : users.findById(row.getUpdatedBy()).map(User::getFullName).orElse("Former member");
        return new GitConfigDtos.View(scope.workspace().getId(), configured,
                configured ? row.getRepositoryUrl() : null, configured ? row.getRepositoryWebUrl() : null,
                configured ? row.getProvider() : null, configured ? row.getDefaultBranch() : null,
                row == null ? 0 : row.getVersion(), row == null ? null : row.getUpdatedAt(), actorName,
                scope.canEdit(), configured && scope.canEdit());
    }
    private Map<String, Object> state(ProjectGitConfig row) {
        Map<String, Object> state = new LinkedHashMap<>();
        state.put("repositoryUrl", row == null ? null : row.getRepositoryUrl());
        state.put("repositoryWebUrl", row == null ? null : row.getRepositoryWebUrl());
        state.put("defaultBranch", row == null ? null : row.getDefaultBranch());
        state.put("version", row == null ? 0 : row.getVersion());
        return state;
    }
    private void audit(Scope scope, String action, Map<String, Object> before, Map<String, Object> after) {
        var event = new WorkspaceAudit();
        event.setEventId(UUID.randomUUID().toString()); event.setActorId(scope.actor().getId());
        event.setTenantId(scope.workspace().getTenant().getId()); event.setTeamId(scope.workspace().getTeam().getId());
        event.setWorkspaceId(scope.workspace().getId());
        event.setProjectId(scope.workspace().getProject() == null ? null : scope.workspace().getProject().getId());
        event.setAction(action); event.setCorrelationId(WorkspaceCorrelation.current());
        try { event.setBeforeJson(json.writeValueAsString(before)); event.setAfterJson(json.writeValueAsString(after)); }
        catch (JsonProcessingException ex) { throw new IllegalStateException("Could not serialize Git audit"); }
        audits.saveAndFlush(event); // Same transaction as config; failure rolls everything back.
    }
}
