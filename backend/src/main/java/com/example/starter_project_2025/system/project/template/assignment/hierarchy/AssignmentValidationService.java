package com.example.starter_project_2025.system.project.template.assignment.hierarchy;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.*;
import com.example.starter_project_2025.system.project.domain.ProjectStatus;
import com.example.starter_project_2025.system.project.ProjectTemplateConstraints.Capacity;
import com.example.starter_project_2025.system.project.ProjectTemplateConstraints.RolePolicy;
import com.example.starter_project_2025.system.project.ProjectTemplateConstraints.RoleQuota;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.tenant.TenantRepository;
import com.example.starter_project_2025.system.project.workspace.repository.WorkspaceRepository;
import com.example.starter_project_2025.system.project.workspace.service.WorkspaceProjectScope;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
@RequiredArgsConstructor
public class AssignmentValidationService {
    public record TeamBrief(ProjectTeam team, List<AssignmentTemplateReader.Node> modules,
                            Capacity capacity, RolePolicy policy) {
        public AssignmentTemplateReader.Node primary() { return modules.getFirst(); }
    }

    public record Selection(List<TeamBrief> briefs, Map<Long, ProjectTeam> owners) { }

    private final TeamAllocationSessionRepository sessions;
    private final ProjectTeamRepository teams;
    private final ProjectMemberRepository members;
    private final WorkspaceRepository workspaces;
    private final WorkspaceProjectScope projectScope;
    private final ScopeAuthorizationService scope;
    private final AssignmentTemplateReader templates;
    private final TenantRepository tenants;
    private final ProjectTeamRoleService roleService;

    public TeamAllocationSession session(Long classId, Long sessionId, Authentication authentication, boolean lock) {
        var session = (lock ? sessions.findByIdForUpdate(sessionId) : sessions.findById(sessionId))
                .filter(value -> classId.equals(value.getTrainingClass().getId()))
                .orElseThrow(() -> AssignmentException.invalid("The allocation session does not belong to this class"));
        if (!(authentication.getPrincipal() instanceof UserPrincipal principal)
                || !Objects.equals(principal.getTenantId(), session.getTrainingClass().getTenantId()))
            throw new AccessDeniedException("The class belongs to another tenant");
        scope.assertCanManageTeamMentor(authentication, session.getTrainingClass());
        if (tenants.findById(session.getTrainingClass().getTenantId())
                .filter(tenant -> Boolean.TRUE.equals(tenant.getIsActive()) && Boolean.TRUE.equals(tenant.getActive())).isEmpty())
            throw new AccessDeniedException("The tenant is no longer active");
        if (!Boolean.TRUE.equals(session.getTrainingClass().getIsActive())
                || session.getStatus() == TeamAllocationSessionStatus.CANCELLED)
            throw AssignmentException.invalid("Select an active class and an available allocation session");
        return session;
    }

    public Selection validate(TeamAllocationSession session, AssignmentTemplateReader.Node master, AssignmentDtos.Request request,
                              Authentication authentication) {
        return validate(session, master, request, authentication, true);
    }

    Selection validate(TeamAllocationSession session, AssignmentTemplateReader.Node master, AssignmentDtos.Request request,
                       Authentication authentication, boolean lockTeams) {
        Map<Long, Long> selected = selectedTeams(master, request);
        Set<Long> templateIds = master.templateIds();
        List<Long> ids = selected.values().stream().distinct().sorted().toList();
        List<ProjectTeam> locked = new ArrayList<>();
        for (Long id : ids) {
            var lookup = lockTeams ? teams.findForWorkspaceCreation(id)
                    : teams.findByIdAndAllocationSession_Id(id, session.getId());
            ProjectTeam team = lookup
                    .filter(value -> value.getAllocationSession().getId().equals(session.getId())
                            && value.getTrainingClass().getId().equals(session.getTrainingClass().getId()))
                    .orElseThrow(() -> AssignmentException.invalid("Every selected team must belong to this class and allocation session"));
            String reason = unavailableReason(team, templateIds);
            if (reason != null) {
                if ("unfinished".equals(reason)) throw AssignmentException.busy(team.getTeamName());
                throw AssignmentException.invalid(team.getTeamName() + ": " + reason);
            }
            locked.add(team);
        }
        Map<Long, ProjectTeam> byId = new LinkedHashMap<>();
        locked.forEach(team -> byId.put(team.getId(), team));
        Map<Long, AssignmentDtos.TeamRoles> roleEdits = new LinkedHashMap<>();
        for (var edit : request.teamRoles()) {
            if (!byId.containsKey(edit.teamId()) || roleEdits.putIfAbsent(edit.teamId(), edit) != null)
                throw AssignmentException.invalid("Configure roles once for each selected team only");
        }
        if (!roleEdits.isEmpty() && !roleEdits.keySet().equals(byId.keySet()))
            throw AssignmentException.invalid("Review member roles for every selected team");
        Map<Long, ProjectTeam> owners = new LinkedHashMap<>();
        Map<Long, List<AssignmentTemplateReader.Node>> modulesByTeam = new LinkedHashMap<>();
        var branches = request.mode() == AssignmentDtos.Mode.WHOLE ? List.of(master) : master.modules();
        for (var module : branches) {
            ProjectTeam team = byId.get(selected.get(module.templateId()));
            modulesByTeam.computeIfAbsent(team.getId(), ignored -> new ArrayList<>()).add(module);
            assignBranch(module, team, owners);
        }
        List<TeamBrief> briefs = new ArrayList<>();
        for (ProjectTeam team : locked) {
            var brief = brief(team, modulesByTeam.get(team.getId()));
            applyRoles(session, brief, roleEdits.get(team.getId()), authentication);
            validateConstraints(brief);
            briefs.add(brief);
        }
        return new Selection(List.copyOf(briefs), owners);
    }

    private TeamBrief brief(ProjectTeam team, List<AssignmentTemplateReader.Node> modules) {
        int minMembers = 0;
        int maxMembers = Integer.MAX_VALUE;
        boolean allowMultiRole = true;
        Map<String, RoleQuota> quotas = new LinkedHashMap<>();
        for (var module : modules) {
            var capacity = templates.capacity(module);
            var policy = templates.roles(module);
            minMembers = Math.max(minMembers, capacity.minMembers());
            maxMembers = Math.min(maxMembers, capacity.maxMembers());
            allowMultiRole &= policy.allowMultiRole();
            for (var quota : policy.quotas()) {
                quotas.merge(quota.role(), quota, (current, next) -> new RoleQuota(current.role(),
                        Math.max(current.min(), next.min()), Math.min(current.max(), next.max())));
            }
        }
        if (minMembers > maxMembers || quotas.values().stream().anyMatch(quota -> quota.min() > quota.max())) {
            throw AssignmentException.invalid(team.getTeamName() + " có các module xung đột về sĩ số hoặc định suất vai trò.");
        }
        return new TeamBrief(team, List.copyOf(modules), new Capacity(minMembers, maxMembers),
                new RolePolicy(allowMultiRole, List.copyOf(quotas.values())));
    }

    private void applyRoles(TeamAllocationSession session, TeamBrief brief,
                             AssignmentDtos.TeamRoles edit, Authentication authentication) {
        if (edit == null) return;
        var request = new UpdateTeamRolesRequest(edit.expectedVersion(), edit.members().stream().map(member ->
                new UpdateTeamRolesRequest.MemberRoleAssignment(member.memberId(), null, member.roles())).toList());
        roleService.updateRolesForAssignment(session, brief.team(), request, brief.policy(), edit.leaderMemberId(), authentication);
    }

    private Map<Long, Long> selectedTeams(AssignmentTemplateReader.Node master, AssignmentDtos.Request request) {
        if (request.mode() == AssignmentDtos.Mode.WHOLE) {
            if (request.teamId() == null || !request.modules().isEmpty())
                throw AssignmentException.invalid("Whole-project assignment requires one team and no module mappings");
            return Map.of(master.templateId(), request.teamId());
        }
        if (request.teamId() != null || master.modules().isEmpty())
            throw AssignmentException.invalid("Split assignment requires a master with child modules");
        Map<Long, Long> result = new LinkedHashMap<>();
        for (var row : request.modules()) {
            if (result.putIfAbsent(row.moduleTemplateId(), row.teamId()) != null)
                throw AssignmentException.invalid("Mỗi module chỉ được giao cho một Team trong lớp.");
        }
        Set<Long> expected = new HashSet<>(master.modules().stream().map(AssignmentTemplateReader.Node::templateId).toList());
        if (!result.keySet().equals(expected))
            throw AssignmentException.invalid("Map every direct child module to exactly one team");
        return result;
    }

    private void assignBranch(AssignmentTemplateReader.Node node, ProjectTeam team, Map<Long, ProjectTeam> owners) {
        owners.put(node.templateId(), team);
        node.modules().forEach(child -> assignBranch(child, team, owners));
    }

    public String unavailableReason(ProjectTeam team, Set<Long> templateIds) {
        if (!Boolean.TRUE.equals(team.getIsActive())) return "The team is no longer available";
        var current = workspaces.findCurrentByTeamId(team.getId());
        if (current.isPresent() && projectScope.projects(current.get()).stream()
                .anyMatch(project -> !Set.of(ProjectStatus.COMPLETED, ProjectStatus.CANCELLED).contains(project.getStatus())))
            return "unfinished";
        if (team.getProject() != null && !Set.of(ProjectStatus.COMPLETED, ProjectStatus.CANCELLED).contains(team.getProject().getStatus()))
            return "unfinished";
        if (team.getStatus() != ProjectTeamStatus.DRAFT
                || team.getAllocationSession().getStatus() != TeamAllocationSessionStatus.OPEN)
            return "Chọn Team DRAFT trong phiên đang mở. Công bố chính thức sau khi lưu phân công.";
        Long assignedTemplateId = team.getProjectTemplateId();
        if (assignedTemplateId != null && !templateIds.contains(assignedTemplateId)) {
            return "Đã gán Project khác.";
        }
        if (activeMembers(team).isEmpty()) return "Add active members before assigning a project";
        return null;
    }

    public List<ProjectMember> activeMembers(ProjectTeam team) {
        return members.findAllByTeam_IdOrderByIdAsc(team.getId()).stream()
                .filter(member -> Boolean.TRUE.equals(member.getIsActive())
                        && Boolean.TRUE.equals(member.getClassMember().getIsActive())
                        && AllocationStudentEligibility.isEligible(member.getClassMember())
                        && member.getClassMember().getTrainingClass().getId().equals(team.getTrainingClass().getId())).toList();
    }

    private void validateConstraints(TeamBrief brief) {
        var team = brief.team();
        List<ProjectMember> roster = activeMembers(team);
        if (ProjectTeamLeaderService.activeLeaderId(team, roster) == null) {
            throw AssignmentException.invalid(team.getTeamName() + " requires an active Leader");
        }
        var capacity = brief.capacity();
        if (!capacity.accepts(roster.size())) throw AssignmentException.invalid(team.getTeamName() + " requires "
                + capacity.window() + " active members for the assigned project work");
        var policy = brief.policy();
        Map<String, Integer> counts = new HashMap<>();
        for (ProjectMember member : roster) {
            List<String> roles = ProjectMemberRole.parseRoles(member.getRole());
            if (!ProjectMemberRole.isValidSpec(member.getRole()) || !policy.allowMultiRole() && roles.size() > 1)
                throw AssignmentException.invalid("Review member roles in " + team.getTeamName() + " before assigning the project");
            roles.forEach(role -> counts.merge(role, 1, Integer::sum));
        }
        for (var quota : policy.quotas()) {
            int count = counts.getOrDefault(quota.role(), 0);
            if (count < quota.min() || count > quota.max()) throw AssignmentException.invalid(team.getTeamName()
                    + " does not meet the " + quota.role() + " role quota for the assigned project work");
        }
    }
}
