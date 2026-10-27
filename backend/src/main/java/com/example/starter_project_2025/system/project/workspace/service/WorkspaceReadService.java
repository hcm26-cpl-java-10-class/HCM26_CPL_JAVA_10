package com.example.starter_project_2025.system.project.workspace.service;

import com.example.starter_project_2025.system.project.cohort.Cohort;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.domain.ProjectTopicSnapshot;
import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.workspace.domain.Workspace;
import com.example.starter_project_2025.system.project.workspace.domain.WorkspaceSection;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceDetailResponse;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceMemberResponse;
import com.example.starter_project_2025.system.project.workspace.dto.WorkspaceTopicSnapshotResponse;
import com.example.starter_project_2025.system.project.workspace.repository.ProjectTopicSnapshotRepository;

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
    private final WorkspaceContextService contexts;
    private final WorkspaceAccessService access;
    private final WorkspaceRosterService roster;
    private final ProjectTopicSnapshotRepository snapshots;
    private final UserRepository users;
    private final ObjectMapper json;

    public WorkspaceDetailResponse overview(Long id) {
        User user = access.requireUser(false);
        Workspace workspace = contexts.require(user, id);
        Project project = workspace.getProject();
        ProjectTeam team = workspace.getTeam();
        var trainingClass = team.getTrainingClass();
        var snapshot = project == null ? null : snapshots.findByProjectId(project.getId()).map(this::snapshotResponse).orElse(null);
        // A blank snapshot description stays blank; do not substitute newer project content.
        String description = snapshot != null ? snapshot.description() : project == null ? null : project.getDescription();
        return WorkspaceDetailResponse.builder()
                .id(workspace.getId()).code(workspace.getCode()).name(workspace.getName())
                .status(workspace.getStatus())
                .projectId(project == null ? null : project.getId())
                .projectCode(project == null ? null : project.getCode())
                .projectName(project == null ? null : project.getName())
                .projectDescription(description).projectStatus(project == null ? null : project.getStatus())
                .teamId(team.getId()).teamCode(team.getCode()).teamName(team.getTeamName())
                .mentorName(team.getAssignedMentorId() == null ? null :
                        users.findById(team.getAssignedMentorId()).map(User::getFullName).orElse(null))
                .charter(ProjectHubDtos.Charter.from(team))
                .cohortId(trainingClass.getCohortId())
                .cohortName(trainingClass.getCohortName())
                .createdAt(workspace.getCreatedAt())
                .createdByName(workspace.getCreatedBy() == null ? null :
                        users.findById(workspace.getCreatedBy()).map(User::getFullName).orElse("Former member"))
                .memberCount(roster.current(team).size())
                .canViewMembers(access.canViewMembers(user))
                .topicSnapshot(snapshot)
                .sections(workspace.getSections().stream().map(WorkspaceSection::getKey).toList())
                .activities(null).build();
    }

    public List<WorkspaceMemberResponse> members(Long id) {
        User user = access.requireUser(false);
        access.requireMemberRead(user);
        Workspace workspace = contexts.require(user, id);
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
