package com.example.starter_project_2025.system.project.milestone.integration.mock;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.ProjectRepository;
import com.example.starter_project_2025.system.project.ProjectTeamRepository;
import com.example.starter_project_2025.system.project.ProjectTeam;
import com.example.starter_project_2025.system.project.ProjectTeamStatus;
import com.example.starter_project_2025.system.project.ProjectMemberRepository;
import com.example.starter_project_2025.system.project.BoardProjectMemberRepository;
import com.example.starter_project_2025.system.project.team.ProjectRole;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceAccessService;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.milestone.dto.response.MilestoneProjectOptionResponse;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectCreationContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectReadContext;
import com.example.starter_project_2025.system.project.milestone.integration.model.ProjectStatus;
import com.example.starter_project_2025.system.project.milestone.integration.port.ProjectMilestonePort;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;
import org.springframework.security.access.AccessDeniedException;
import java.nio.charset.StandardCharsets;
import java.util.Objects;
import java.util.Set;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Component
@Profile("!milestone-mock")
public class MockProjectMilestoneAdapter implements ProjectMilestonePort {

    private final ProjectRepository projects;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final BoardProjectMemberRepository boardMembers;
    private final WorkspaceAccessService access;

    public MockProjectMilestoneAdapter(
            ProjectRepository projects,
            ProjectTeamRepository teams,
            ProjectMemberRepository members,
            BoardProjectMemberRepository boardMembers,
            WorkspaceAccessService access
    ) {
        this.projects = projects;
        this.teams = teams;
        this.members = members;
        this.boardMembers = boardMembers;
        this.access = access;
    }

    @Override
    public ProjectCreationContext requireProjectForCreation(Long projectId, UUID actorId, Long tenantId) {
        User actor = actor(actorId, tenantId, "MILESTONE_WRITE");
        Project project = requireProject(projectId, tenantId);
        requireScope(project, actor, true);
        ProjectStatus status = mapStatus(project.getStatus());

        return new ProjectCreationContext(
                projectId,
                tenantId,
                project.getName(),
                status,
                tenantActive(project),
                true,
                status == ProjectStatus.ACTIVE || status == ProjectStatus.PLANNING
        );
    }

    @Override
    public ProjectReadContext requireProjectForRead(Long projectId, UUID actorId, Long tenantId) {
        User actor = actor(actorId, tenantId, "MILESTONE_READ");
        Project project = requireProject(projectId, tenantId);
        requireScope(project, actor, false);
        return new ProjectReadContext(
                projectId,
                tenantId,
                project.getName(),
                mapStatus(project.getStatus()),
                tenantActive(project),
                true
        );
    }

    @Override
    public List<MilestoneProjectOptionResponse> listAccessibleProjects(UUID actorId, Long tenantId) {
        User actor = actor(actorId, tenantId, "MILESTONE_READ");
        List<Project> activeProjects = projects.findByTenantIdAndIsActiveTrue(tenantId).stream()
                .filter(this::tenantActive)
                .filter(project -> allowed(project, actor, false))
                .filter(project -> project.getStatus() != null)
                .toList();

        List<Project> realProjects = activeProjects.stream()
                .filter(project -> project.getCode() == null || !project.getCode().startsWith("DEMO-"))
                .toList();

        List<Project> candidates = realProjects.isEmpty() ? activeProjects : realProjects;
        return candidates.stream()
                .sorted(Comparator
                        .comparingInt((Project p) -> statusPriority(mapStatus(p.getStatus())))
                        .thenComparing(p -> p.getName() == null ? "" : p.getName().toLowerCase(Locale.ROOT))
                        .thenComparing(Project::getId))
                .map(project -> new MilestoneProjectOptionResponse(
                        project.getId(),
                        project.getCode(),
                        project.getName(),
                        mapStatus(project.getStatus())
                ))
                .toList();
    }

    private int statusPriority(ProjectStatus status) {
        return switch (status) {
            case ACTIVE -> 0;
            case PLANNING -> 1;
            case DRAFT -> 2;
            case COMPLETED -> 3;
            case CANCELLED -> 4;
        };
    }

    private Project requireProject(Long projectId, Long tenantId) {
        Project project = projects.findById(projectId)
                .filter(candidate -> Boolean.TRUE.equals(candidate.getIsActive()))
                .orElseThrow(() ->
                        new ResourceNotFoundException("Project not found"));
        if (project.getTenant() == null || !Objects.equals(tenantId, project.getTenantId())) {
            throw new AccessDeniedException("Project is outside the current tenant");
        }
        return project;
    }

    private boolean tenantActive(Project project) {
        return project.getTenant() != null
                && Boolean.TRUE.equals(project.getTenant().getActive())
                && Boolean.TRUE.equals(project.getTenant().getIsActive());
    }

    private User actor(UUID actorId, Long tenantId, String permission) {
        User user = access.requireUser(false);
        access.requireTenant(user, false);
        if (!Objects.equals(user.getTenantId(), tenantId)
                || !UUID.nameUUIDFromBytes(user.getEmail().getBytes(StandardCharsets.UTF_8)).equals(actorId)
                || !access.permitted(user, permission)) {
            throw new AccessDeniedException("Milestone permission is unavailable or has changed");
        }
        return user;
    }

    private void requireScope(Project project, User actor, boolean creating) {
        if (!allowed(project, actor, creating)) {
            throw new AccessDeniedException("Project is outside your active assignment scope");
        }
    }

    private boolean allowed(Project project, User actor, boolean creating) {
        if (actor.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && Set.of("ADMIN", "ADMINISTRATOR", "SUPER_ADMIN", "SYSTEM_ADMIN").contains(role.getName()))) return true;
        var assignedTeams = teams.findAllByProject_IdInOrderByIdDesc(List.of(project.getId()));
        if (!assignedTeams.isEmpty()) return assignedTeams.stream()
                .filter(team -> Boolean.TRUE.equals(team.getIsActive()) && team.getStatus() == ProjectTeamStatus.ACTIVE
                        && Boolean.TRUE.equals(team.getTrainingClass().getIsActive())
                        && Objects.equals(team.getTrainingClass().getTenantId(), project.getTenantId()))
                .anyMatch(team -> Objects.equals(team.getAssignedMentorId(), actor.getId())
                        || Objects.equals(team.getTrainingClass().getMentorId(), actor.getId())
                        || !creating && currentMember(team, actor));
        // Legacy Board projects retain their explicit roster until converted to a class team.
        return boardMembers.existsByProjectIdAndUserIdAndProjectRoleInAndIsActiveTrue(project.getId(), actor.getId(),
                creating ? List.of(ProjectRole.MENTOR) : List.of(ProjectRole.values()));
    }

    private boolean currentMember(ProjectTeam team, User actor) {
        return members.findByTeam_IdAndClassMember_User_Id(team.getId(), actor.getId())
                .filter(member -> Boolean.TRUE.equals(member.getIsActive()) && Boolean.TRUE.equals(member.getClassMember().getIsActive())
                        && member.getClassMember().getStatus() == ClassMemberStatus.ACTIVE
                        && Objects.equals(member.getClassMember().getTrainingClass().getId(), team.getTrainingClass().getId()))
                .isPresent();
    }

    private ProjectStatus mapStatus(com.example.starter_project_2025.system.project.domain.ProjectStatus status) {
        if (status == null) {
            throw new ResourceNotFoundException("Project not found");
        }
        return switch (status) {
            case DRAFT -> ProjectStatus.DRAFT;
            case PLANNING -> ProjectStatus.PLANNING;
            case ACTIVE -> ProjectStatus.ACTIVE;
            case COMPLETED -> ProjectStatus.COMPLETED;
            case CANCELLED -> ProjectStatus.CANCELLED;
        };
    }
}
