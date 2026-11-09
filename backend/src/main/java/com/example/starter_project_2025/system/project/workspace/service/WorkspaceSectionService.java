package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;

import com.example.starter_project_2025.system.rbac.user.User;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Arrays;
import static com.example.starter_project_2025.system.project.workspace.dto.WorkspaceSectionDtos.*;

@Service @RequiredArgsConstructor @Transactional(readOnly = true)
public class WorkspaceSectionService {
    private record Context(User user, Workspace workspace, Scope scope) { }

    /** The workspace Kanban board always uses exactly these four statuses. */
    private static final Set<String> BOARD_STATUS_KEYS = Set.of("TODO", "IN_PROGRESS", "REVIEW", "DONE");
    private static final List<BoardColumn> DEFAULT_BOARD_COLUMNS = List.of(
            new BoardColumn("TODO", "To do", true),
            new BoardColumn("IN_PROGRESS", "In progress", true),
            new BoardColumn("REVIEW", "Review", true),
            new BoardColumn("DONE", "Done", true));

    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceSectionPolicy policy;
    private final WorkspaceSectionDataSource source;
    private final ObjectMapper objectMapper;

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
        var project = context.workspace().getProject();
        var team = context.workspace().getTeam();
        return new Navigation(id, context.scope().projectId(), context.scope().teamId(),
                team.getTrainingClass().getId(), team.getAllocationSession().getId(),
                project == null ? null : project.getCode(), project == null ? null : project.getName(),
                context.workspace().getTeam().getTeamName(), project == null ? null : project.getStatus(),
                context.workspace().getTaskKeyPrefix(), Arrays.stream(WorkspaceSection.values())
                .map(section -> policy.describe(context.user(), section)).toList());
    }

    public BoardColumns boardColumns(Long id) {
        String json = context(id).workspace().getBoardColumnsConfig();
        if (json == null || json.isBlank()) return defaultBoardColumns();
        try {
            List<BoardColumn> stored = objectMapper.readValue(json, new TypeReference<List<BoardColumn>>() { });
            Map<String, BoardColumn> storedByKey = new LinkedHashMap<>();
            stored.stream()
                    .filter(column -> BOARD_STATUS_KEYS.contains(column.key()))
                    .forEach(column -> storedByKey.putIfAbsent(column.key(), column));
            // Guarantee the four workflow columns, including Review for
            // workspaces saved while the old Backlog column still existed.
            List<BoardColumn> normalized = DEFAULT_BOARD_COLUMNS.stream()
                    .map(column -> new BoardColumn(column.key(), column.label(),
                            storedByKey.getOrDefault(column.key(), column).visible()))
                    .toList();
            return new BoardColumns(normalized);
        } catch (JsonProcessingException | RuntimeException ex) {
            return defaultBoardColumns();
        }
    }

    @Transactional
    public BoardColumns updateBoardColumns(Long id, BoardColumns request) {
        Context context = context(id);
        if (!access.permitted(context.user(), "SPRINT_WRITE")
                && !access.permitted(context.user(), "SPRINT_BACKLOG_UPDATE"))
            throw new AccessDeniedException("Sprint board update permission is required to configure the team board");
        List<BoardColumn> columns = request.columns();
        if (!columns.stream().map(BoardColumn::key).toList().equals(
                    DEFAULT_BOARD_COLUMNS.stream().map(BoardColumn::key).toList())
                || java.util.stream.IntStream.range(0, columns.size()).anyMatch(index ->
                    !columns.get(index).label().equals(DEFAULT_BOARD_COLUMNS.get(index).label()))
                || columns.stream().noneMatch(BoardColumn::visible)) {
            throw new org.springframework.web.server.ResponseStatusException(
                    org.springframework.http.HttpStatus.UNPROCESSABLE_ENTITY,
                    "Keep the four fixed statuses in order: TODO, IN_PROGRESS, REVIEW, DONE. Status names cannot be changed.");
        }
        try {
            context.workspace().setBoardColumnsConfig(objectMapper.writeValueAsString(columns));
            return new BoardColumns(columns);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not save board configuration", ex);
        }
    }

    private BoardColumns defaultBoardColumns() {
        return new BoardColumns(DEFAULT_BOARD_COLUMNS);
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
