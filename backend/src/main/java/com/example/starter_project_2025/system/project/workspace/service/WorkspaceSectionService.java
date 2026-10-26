package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.util.Arrays;
import static com.example.starter_project_2025.system.project.WorkspaceSectionDtos.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class WorkspaceSectionService {
    private record Context(User user, Workspace workspace, Scope scope) { }
    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceSectionPolicy policy;
    private final WorkspaceSectionDataSource source;

    private Context context(Long id) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, id);
        return new Context(user, workspace, Scope.from(workspace));
    }
    private void requireRead(Context context, WorkspaceSection section) {
        if (!policy.canRead(context.user(), section)) throw new AccessDeniedException("Section access has changed");
    }
    private void requireAction(Context context, WorkspaceSection section, String action) {
        requireRead(context, section);
        if (!Boolean.TRUE.equals(policy.describe(context.user(), section).actions().get(action)))
            throw new AccessDeniedException("This section action is not allowed");
    }
    public Navigation navigation(Long id) {
        Context context = context(id);
        return new Navigation(id, context.scope().projectId(), context.scope().teamId(),
                context.workspace().getProject().getCode(), context.workspace().getProject().getName(),
                context.workspace().getTeam().getTeamName(), context.workspace().getProject().getStatus(),
                Arrays.stream(WorkspaceSection.values())
                .map(section -> policy.describe(context.user(), section)).toList());
    }
    public Content read(Long id, String key) {
        Context context = context(id);
        WorkspaceSection section = policy.section(key);
        requireRead(context, section);
        if (section == WorkspaceSection.OVERVIEW || section == WorkspaceSection.MEMBERS)
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.NOT_FOUND, "Use the existing Overview or Members API");
        var rows = source.list(context.scope(), section).stream()
                .filter(item -> item.published() || policy.canSeeDrafts(context.user(), section)).toList();
        return new Content(id, context.scope().projectId(), context.scope().teamId(), key, rows);
    }
    @Transactional
    public Item create(Long id, WorkspaceSection section, Create request) {
        Context context = context(id);
        requireAction(context, section, "create");
        return source.create(context.scope(), section, request, request.published() ? "OPEN" : "DRAFT");
    }
    @Transactional
    public Item task(Long id, Create request, String taskId) {
        Context context = context(id);
        requireAction(context, WorkspaceSection.BACKLOG, "createTask");
        return taskId == null ? source.create(context.scope(), WorkspaceSection.BACKLOG, request, "TODO")
                : source.updateTask(context.scope(), taskId, request);
    }
    @Transactional
    public Item submit(Long id, Create request) {
        Context context = context(id);
        requireAction(context, WorkspaceSection.ARTIFACT, "submit");
        return source.create(context.scope(), WorkspaceSection.ARTIFACT,
                new Create(request.title(), request.description(), false), "SUBMITTED");
    }
    @Transactional
    public Item review(Long id, Review request) {
        Context context = context(id);
        WorkspaceSection target = switch (request.kind()) {
            case ARTIFACT -> WorkspaceSection.ARTIFACT;
            case MILESTONE -> WorkspaceSection.MILESTONE;
            case SPRINT -> WorkspaceSection.SPRINT;
        };
        requireAction(context, target, "review");
        return source.review(context.scope(), request);
    }
}
