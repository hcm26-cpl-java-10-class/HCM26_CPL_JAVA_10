package com.example.starter_project_2025.system.project.service;

import com.example.starter_project_2025.system.project.cohort.Cohort;
import com.example.starter_project_2025.system.project.domain.Project;
import com.example.starter_project_2025.system.project.dto.ProjectHubDtos;
import com.example.starter_project_2025.system.project.team.Team;
import com.example.starter_project_2025.system.project.team.TeamMember;
import com.example.starter_project_2025.system.project.team.TeamRepository;
import com.example.starter_project_2025.system.project.tenant.Tenant;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.spec.WorkspaceCandidateSpec;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ProjectHubService {
    private final TenantRepository tenants;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final UserRepository users;
    private static final Set<String> MENTOR_ROLES = Set.of("MENTOR", "TRAINER", "TEACHER");

    private UserPrincipal principal() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof UserPrincipal principal)
                || principal.getTenantId() == null) throw new AccessDeniedException("Tenant context is not available");
        return principal;
    }

    private Tenant tenant() {
        Tenant tenant = tenants.findById(principal().getTenantId())
                .orElseThrow(() -> new AccessDeniedException("Tenant is not available"));
        if (!Boolean.TRUE.equals(tenant.getActive()) || !Boolean.TRUE.equals(tenant.getIsActive())) throw new AccessDeniedException("Tenant is inactive");
        return tenant;
    }

    private Specification<ProjectTeam> scope() {
        return WorkspaceCandidateSpec.forScope(principal().getUser().getId(), tenant().getId());
    }

    private ProjectTeam scopedTeam(Long id) {
        return teams.findOne(scope().and((root, query, cb) -> cb.and(
                        cb.equal(root.get("id"), id),
                        cb.equal(root.get("status"), ProjectTeamStatus.ACTIVE),
                        cb.isTrue(root.get("isActive")))))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy team trong phạm vi được phép"));
    }

    public List<ProjectHubDtos.TeamView> getTeams() {
        return teams.findAll(scope()).stream().filter(team -> team.getStatus() == ProjectTeamStatus.ACTIVE)
                .map(this::teamView)
                .sorted(Comparator.comparing(ProjectHubDtos.TeamView::name)).toList();
    }

    private boolean eligibleMentor(User user) {
        return Boolean.TRUE.equals(user.getIsActive()) && !Boolean.TRUE.equals(user.getLocked())
                && user.getRoles().stream().anyMatch(role -> Boolean.TRUE.equals(role.getIsActive())
                && MENTOR_ROLES.contains(role.getName().toUpperCase(java.util.Locale.ROOT)));
    }

    public List<ProjectHubDtos.Mentor> getMentors() {
        return users.findByTenantIdAndIsActiveTrue(tenant().getId()).stream().filter(this::eligibleMentor)
                .map(user -> new ProjectHubDtos.Mentor(user.getId(), user.getFullName(), user.getEmail()))
                .sorted(Comparator.comparing(ProjectHubDtos.Mentor::name)).toList();
    }

    @Transactional
    public ProjectHubDtos.TeamView assignMentor(Long id, ProjectHubDtos.MentorAssignment request) {
        ProjectTeam team = scopedTeam(id);
        User mentor = null;
        if (request.mentorId() != null) {
            mentor = users.findById(request.mentorId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mentor"));
            if (mentor.getTenant() == null || !mentor.getTenant().getId().equals(team.getTrainingClass().getTenantId()) || !eligibleMentor(mentor)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Mentor không hợp lệ hoặc không thuộc tenant của team");
            }
        }
        team.setAssignedMentorId(mentor == null ? null : mentor.getId());
        return teamView(teams.saveAndFlush(team));
    }

    @Transactional
    public ProjectHubDtos.TeamView saveCharter(Long id, ProjectHubDtos.Charter charter) {
        ProjectTeam team = scopedTeam(id);
        team.setMission(charter.mission());
        team.setDefinitionOfDone(charter.definitionOfDone());
        String channel = charter.primaryChannel();
        if (channel != null && !channel.isBlank() && !Set.of("Microsoft Teams", "Teams", "Slack", "Discord", "Google Chat", "Email").contains(channel)
                && !channel.equals(team.getPrimaryChannel())) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Select a supported primary channel");
        }
        team.setPrimaryChannel("Teams".equals(channel) ? "Microsoft Teams" : channel);
        team.setCoreHours(charter.coreHours());
        team.setConflictResolution(charter.conflictResolution());
        return teamView(teams.saveAndFlush(team));
    }

    private ProjectHubDtos.TeamView teamView(ProjectTeam team) {
        Project project = team.getProject();
        var trainingClass = team.getTrainingClass();
        var teamMembers = members.findAllByTeam_IdAndClassMember_StatusOrderByIdAsc(
                team.getId(), com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus.ACTIVE);
        var memberViews = teamMembers.stream().map(ProjectMember::getClassMember)
                .map(member -> member.getUser())
                .map(user -> new ProjectHubDtos.Member(user.getId(), user.getFullName(), user.getEmail()))
                .sorted(Comparator.comparing(ProjectHubDtos.Member::name)).toList();
        String mentorName = team.getAssignedMentorId() == null ? null :
                users.findById(team.getAssignedMentorId()).map(User::getFullName).orElse(null);
        return new ProjectHubDtos.TeamView(team.getId(), team.getCode(), team.getTeamName(),
                project != null ? project.getId() : null, project != null ? project.getName() : null,
                trainingClass.getCohortId(), trainingClass.getCohortName(),
                team.getAssignedMentorId(), mentorName, memberViews, ProjectHubDtos.Charter.from(team));
    }
}
