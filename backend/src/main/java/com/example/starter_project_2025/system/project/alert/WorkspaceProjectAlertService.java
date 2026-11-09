package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEvent;
import com.example.starter_project_2025.system.project.milestone.outbox.OutboxEventRepository;
import com.example.starter_project_2025.system.project.task.TaskConflictException;
import com.example.starter_project_2025.system.project.task.TaskValidationException;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceStatus;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceContextService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/** A committed alert batch is the team's posted notification; outbox delivery is a separate concern. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceProjectAlertService {
    private static final Set<ProjectAlertDtos.Kind> KINDS = Set.of(ProjectAlertDtos.Kind.BACKLOG, ProjectAlertDtos.Kind.MILESTONE);
    private final WorkspaceAccessService access;
    private final WorkspaceContextService contexts;
    private final WorkspaceRepository workspaces;
    private final ProjectAlertBatchRepository batches;
    private final OutboxEventRepository outbox;
    private final UserRepository users;
    private final ObjectMapper json;

    public void requireDestination(ProjectTeam team) {
        workspaces.findFirstByTeamIdOrderByIdAsc(team.getId())
                .filter(workspace -> Boolean.TRUE.equals(workspace.getIsActive()))
                .filter(workspace -> workspace.getStatus() == WorkspaceStatus.ACTIVE)
                .filter(workspace -> Objects.equals(workspace.getTenant().getId(), team.getTrainingClass().getTenantId()))
                .filter(workspace -> Objects.equals(projectId(workspace), team.getProjectId()))
                .orElseThrow(() -> new TaskConflictException("This team has no available workspace. Reload the team before sending an alert."));
    }

    public WorkspaceProjectAlertDtos.Page sent(Long workspaceId, int page, int size, ProjectAlertDtos.Kind kind) {
        User actor = access.requireUser(false);
        Workspace workspace = contexts.require(actor, workspaceId);
        if (page < 0 || size < 1 || size > 100) throw new TaskValidationException("page", "Use a non-negative page and a size between 1 and 100");
        if (kind != null && !KINDS.contains(kind)) throw new TaskValidationException("kind", "Only task and milestone alerts are available");
        var result = batches.findByTeamIdAndTenantIdAndProjectIdAndKindIn(workspace.getTeam().getId(),
                workspace.getTenant().getId(), projectId(workspace), kind == null ? KINDS : Set.of(kind),
                PageRequest.of(page, size, Sort.by(Sort.Order.desc("createdAt"), Sort.Order.desc("id"))));
        Map<UUID, OutboxEvent> snapshots = outbox.findAllById(result.getContent().stream().map(ProjectAlertData.Batch::getId).toList())
                .stream().collect(Collectors.toMap(OutboxEvent::getEventId, Function.identity()));
        Map<Long, User> senders = users.findAllById(result.getContent().stream().map(ProjectAlertData.Batch::getActorId).distinct().toList())
                .stream().collect(Collectors.toMap(User::getId, Function.identity()));
        var alerts = result.getContent().stream().map(batch -> new WorkspaceProjectAlertDtos.SentAlert(batch.getId(),
                batch.getKind(), batch.getWarningNote(), batch.getActorId(),
                senders.containsKey(batch.getActorId()) ? senders.get(batch.getActorId()).getFullName() : "Former user",
                batch.getRecipientCount(), batch.getCreatedAt(), "SENT", items(snapshots.get(batch.getId())))).toList();
        return new WorkspaceProjectAlertDtos.Page(workspaceId, workspace.getTeam().getId(), alerts, result.getTotalElements(), page, size);
    }

    private Long projectId(Workspace workspace) {
        return workspace.getProject() == null ? workspace.getTeam().getProjectId() : workspace.getProject().getId();
    }

    private List<WorkspaceProjectAlertDtos.Item> items(OutboxEvent event) {
        if (event == null) return List.of();
        try {
            JsonNode rows = json.readTree(event.getPayloadJson()).path("items");
            List<WorkspaceProjectAlertDtos.Item> items = new ArrayList<>();
            if (rows.isArray()) for (JsonNode row : rows) {
                JsonNode progress = row.path("progress");
                items.add(new WorkspaceProjectAlertDtos.Item(text(row, "id"), text(row, "title"), text(row, "status"),
                        row.path("deadline").isTextual() ? Instant.parse(row.get("deadline").asText()) : null,
                        text(row, "assigneeName"), progress.path("percentage").isNumber() ? progress.get("percentage").decimalValue() : null,
                        progress.path("done").isNumber() ? progress.get("done").asLong() : null,
                        progress.path("total").isNumber() ? progress.get("total").asLong() : null));
            }
            return List.copyOf(items);
        } catch (Exception legacyPayload) {
            // The posted note remains readable even when a historical delivery payload is unavailable.
            return List.of();
        }
    }

    private String text(JsonNode row, String field) {
        return row.path(field).isTextual() ? row.get(field).asText() : null;
    }
}
