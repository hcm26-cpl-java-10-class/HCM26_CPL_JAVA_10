package com.example.starter_project_2025.system.project;

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
    private final TeamRepository teams;
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

    private Specification<Team> scope() {
        return WorkspaceCandidateSpec.forScope(principal().getUser().getId(), tenant().getId());
    }

    private Team scopedTeam(Long id) {
        return teams.findOne(scope().and((root, query, cb) -> cb.equal(root.get("id"), id)))
                .orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy team trong phạm vi được phép"));
    }

    public List<ProjectHubDtos.TeamView> getTeams() {
        return teams.findAll(scope()).stream().map(this::teamView)
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
        Team team = scopedTeam(id);
        User mentor = null;
        if (request.mentorId() != null) {
            mentor = users.findById(request.mentorId()).orElseThrow(() -> new ResourceNotFoundException("Không tìm thấy mentor"));
            if (mentor.getTenant() == null || !mentor.getTenant().getId().equals(team.getTenant().getId()) || !eligibleMentor(mentor)) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY, "Mentor không hợp lệ hoặc không thuộc tenant của team");
            }
        }
        team.setMentor(mentor);
        return teamView(teams.saveAndFlush(team));
    }

    @Transactional
    public ProjectHubDtos.TeamView saveCharter(Long id, ProjectHubDtos.Charter charter) {
        Team team = scopedTeam(id);
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

    private ProjectHubDtos.TeamView teamView(Team team) {
        Project project = team.getProject();
        Cohort cohort = project != null ? project.getCohort() : null;
        var members = team.getMembers().stream().map(TeamMember::getUser)
                .map(user -> new WorkspaceDetailResponse.Member(user.getId(), user.getFullName(), user.getEmail()))
                .sorted(Comparator.comparing(WorkspaceDetailResponse.Member::name)).toList();
        return new ProjectHubDtos.TeamView(team.getId(), team.getCode(), team.getName(), project != null ? project.getId() : null, project != null ? project.getName() : null,
                cohort != null ? cohort.getId() : null, cohort != null ? cohort.getName() : null,
                team.getMentor() != null ? team.getMentor().getId() : null,
                team.getMentor() != null ? team.getMentor().getFullName() : null, members, ProjectHubDtos.Charter.from(team));
    }
}
