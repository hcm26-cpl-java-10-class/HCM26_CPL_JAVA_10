package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class WorkspaceReadService {
    private final WorkspaceRepository workspaces;
    private final WorkspaceAccessService access;
    private final WorkspaceRosterService roster;
    private final ProjectTopicSnapshotRepository snapshots;
    private final WorkspaceActivityRepository activities;
    private final UserRepository users;
    private final ObjectMapper json;

    private Workspace authorizedWorkspace(User user, Long id) {
        access.requireTenant(user, false);
        Workspace workspace = workspaces.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found"));
        if (!Boolean.TRUE.equals(workspace.getIsActive()))
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Workspace was not found");
        if (!workspace.getTenant().getId().equals(user.getTenant().getId()))
            throw new AccessDeniedException("Workspace is outside the current tenant");
        access.requirePair(user, workspace.getProject().getId(), workspace.getTeam().getId(), false);
        return workspace;
    }

    public WorkspaceDetailResponse overview(Long id) {
        User user = access.requireUser(false);
        Workspace workspace = authorizedWorkspace(user, id);
        Project project = workspace.getProject();
        Team team = workspace.getTeam();
        Cohort cohort = project.getCohort();
        var snapshot = snapshots.findByProjectId(project.getId()).map(this::snapshotResponse).orElse(null);
        // A blank snapshot description stays blank; do not substitute newer project content.
        String description = snapshot != null ? snapshot.description() : project.getDescription();
        var history = activities.findByWorkspaceIdOrderByOccurredAtDesc(id).stream()
                .map(item -> new WorkspaceDetailResponse.ActivityItem(
                        item.getEventId(), item.getAction(), item.getActorId(),
                        users.findById(item.getActorId()).map(User::getFullName).orElse("Former member"),
                        item.getOccurredAt(), item.getCorrelationId())).toList();

        return WorkspaceDetailResponse.builder()
                .id(workspace.getId()).code(workspace.getCode()).name(workspace.getName())
                .status(workspace.getStatus())
                .projectId(project.getId()).projectCode(project.getCode()).projectName(project.getName())
                .projectDescription(description).projectStatus(project.getStatus())
                .teamId(team.getId()).teamCode(team.getCode()).teamName(team.getName())
                .mentorName(team.getMentor() != null ? team.getMentor().getFullName() : null)
                .charter(ProjectHubDtos.Charter.from(team))
                .cohortId(cohort != null ? cohort.getId() : null)
                .cohortName(cohort != null ? cohort.getName() : null)
                .createdAt(workspace.getCreatedAt())
                .createdByName(workspace.getCreatedBy() == null ? null :
                        users.findById(workspace.getCreatedBy()).map(User::getFullName).orElse("Former member"))
                .memberCount(roster.current(team).size())
                .canViewMembers(access.canViewMembers(user))
                .topicSnapshot(snapshot)
                .sections(workspace.getSections().stream().map(WorkspaceSection::getKey).toList())
                .activities(history).build();
    }

    public List<WorkspaceMemberResponse> members(Long id) {
        User user = access.requireUser(false);
        access.requireMemberRead(user);
        Workspace workspace = authorizedWorkspace(user, id);
        return roster.response(roster.current(workspace.getTeam()));
    }

    private WorkspaceTopicSnapshotResponse snapshotResponse(ProjectTopicSnapshot snapshot) {
        List<String> requirements = readList(snapshot.getRequirementsJson(),
                new TypeReference<List<String>>() { });
        List<WorkspaceTopicSnapshotResponse.Attachment> attachments = readList(
                snapshot.getAttachmentsJson(),
                new TypeReference<List<WorkspaceTopicSnapshotResponse.Attachment>>() { });
        return new WorkspaceTopicSnapshotResponse(
                snapshot.getTopicCode(), snapshot.getTopicTitle(), snapshot.getVersion(),
                snapshot.getDescription(), snapshot.getObjectives(),
                requirements.stream().filter(item -> !item.isBlank()).toList(), attachments);
    }

    private <T> List<T> readList(String value, TypeReference<List<T>> type) {
        if (value == null || value.isBlank()) return List.of();
        try {
            List<T> values = json.readValue(value, type);
            return values == null ? List.of() : values.stream().filter(Objects::nonNull).toList();
        } catch (JsonProcessingException exception) {
            // Broken stored data must produce an error, not a misleading empty state.
            throw new IllegalStateException("Stored topic snapshot contains invalid JSON", exception);
        }
    }
}
