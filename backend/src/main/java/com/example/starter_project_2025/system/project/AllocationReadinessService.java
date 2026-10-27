package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-12 / BR-UNI-10: strict-mode readiness validation for a class before a
 * {@link TeamAllocationSession} can be published.
 *
 * <p>The service is read-only and is used by two entry points:
 * <ul>
 *     <li>{@code GET .../readiness} — the UI pre-check,</li>
 *     <li>{@code POST .../publish-session} — the authoritative check that runs
 *     inside the publish transaction.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class AllocationReadinessService {

    public static final String ERR_UNASSIGNED_MEMBERS = "ERR_UNASSIGNED_MEMBERS";
    public static final String ERR_TEAMS_NOT_READY = "ERR_TEAMS_NOT_READY";
    public static final String ERR_NO_TEAMS = "ERR_NO_TEAMS";
    public static final String ERR_SESSION_NOT_OPEN = "ERR_SESSION_NOT_OPEN";
    public static final String ERR_TEAM_TEMPLATE_REQUIRED = "ERR_TEAM_TEMPLATE_REQUIRED";
    public static final String ERR_TEAM_TEMPLATE_INVALID = "ERR_TEAM_TEMPLATE_INVALID";
    public static final String ERR_TEAM_CAPACITY_EXCEEDED = "ERR_TEAM_CAPACITY_EXCEEDED";
    public static final String ERR_TEAM_ROLE_REQUIRED = "ERR_TEAM_ROLE_REQUIRED";
    public static final String ERR_MULTI_ROLE_NOT_ALLOWED = "ERR_MULTI_ROLE_NOT_ALLOWED";
    public static final String ERR_TEAM_ROLE_QUOTA_NOT_MET = "ERR_TEAM_ROLE_QUOTA_NOT_MET";

    private final TrainingClassRepository trainingClassRepository;
    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository memberRepository;
    private final ClassMemberRepository classMemberRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ObjectMapper objectMapper;

    /** US-12 pre-check endpoint: validates the caller can manage the class. */
    @Transactional(readOnly = true)
    public AllocationReadinessResponse evaluateForClass(
            Long classId,
            Long sessionId,
            Authentication authentication
    ) {
        TrainingClass trainingClass = trainingClassRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TrainingClass", "id", classId));
        scopeAuthorizationService.assertCanManageTeamMentor(authentication, trainingClass);

        TeamAllocationSession session = sessionRepository
                .findByIdAndTrainingClass_Id(sessionId, classId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        return build(session);
    }

    /**
     * Strict check used by the publish coordinator. The caller has already
     * loaded/locked and authorized the session.
     */
    @Transactional(readOnly = true)
    public AllocationReadinessResponse evaluateSession(Long sessionId) {
        TeamAllocationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        return build(session);
    }

    private AllocationReadinessResponse build(TeamAllocationSession session) {
        Long classId = session.getTrainingClass().getId();

        List<ClassMember> activeMembers = classMemberRepository
                .findAllByTrainingClass_IdAndStatusOrderByIdAsc(
                        classId, ClassMemberStatus.ACTIVE);

        Set<Long> assignedMemberIds = new HashSet<>(memberRepository
                .findAssignedMemberIdsBySessionAndTeamStatuses(
                        session.getId(),
                        List.of(ProjectTeamStatus.DRAFT, ProjectTeamStatus.ACTIVE)));

        List<AllocationReadinessResponse.UnassignedStudent> unassignedStudents =
                activeMembers.stream()
                        .filter(member -> !assignedMemberIds.contains(member.getId()))
                        .map(member -> new AllocationReadinessResponse.UnassignedStudent(
                                member.getId(),
                                member.getUser().getFullName()))
                        .toList();

        List<ProjectTeam> teams = teamRepository
                .findAllByAllocationSession_IdOrderByIdAsc(session.getId())
                .stream()
                .filter(team -> team.getStatus() != ProjectTeamStatus.ARCHIVED)
                .toList();

        List<AllocationReadinessResponse.TeamReadinessIssue> teamIssues = new ArrayList<>();
        int teamsWithTemplate = 0;
        int draftTeamCount = 0;
        int activeTeamCount = 0;
        for (ProjectTeam team : teams) {
            if (team.getStatus() == ProjectTeamStatus.DRAFT) {
                draftTeamCount++;
            } else if (team.getStatus() == ProjectTeamStatus.ACTIVE) {
                activeTeamCount++;
            }
            if (team.getProjectTemplate() != null) {
                teamsWithTemplate++;
            }
            teamIssues.addAll(inspectTeam(team));
        }

        Set<String> blockers = new LinkedHashSet<>();
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            blockers.add(ERR_SESSION_NOT_OPEN);
        }
        if (teams.isEmpty()) {
            blockers.add(ERR_NO_TEAMS);
        }
        if (!unassignedStudents.isEmpty()) {
            blockers.add(ERR_UNASSIGNED_MEMBERS);
        }
        teamIssues.forEach(issue -> blockers.add(issue.code()));

        boolean readyToPublish = blockers.isEmpty();

        return new AllocationReadinessResponse(
                session.getId(),
                classId,
                session.getStatus(),
                readyToPublish,
                activeMembers.size(),
                activeMembers.size() - unassignedStudents.size(),
                unassignedStudents.size(),
                unassignedStudents,
                teams.size(),
                draftTeamCount,
                activeTeamCount,
                teamsWithTemplate,
                teamIssues,
                List.copyOf(blockers),
                LocalDateTime.now());
    }

    /**
     * Inspects one team against the strict publish rules: template present and
     * parseable, capacity window respected, every member has a role and the
     * template role quotas are satisfied.
     */
    private List<AllocationReadinessResponse.TeamReadinessIssue> inspectTeam(
            ProjectTeam team
    ) {
        ProjectTemplate template = team.getProjectTemplate();
        if (template == null) {
            return List.of(issue(
                    team,
                    ERR_TEAM_TEMPLATE_REQUIRED,
                    "Nhóm chưa được gán đề bài dự án hợp lệ.",
                    List.of(),
                    List.of()));
        }
        if (Boolean.FALSE.equals(template.getIsActive())) {
            return List.of(issue(
                    team,
                    ERR_TEAM_TEMPLATE_INVALID,
                    "Đề bài dự án đã được gán không còn hoạt động (ACTIVE).",
                    List.of(),
                    List.of()));
        }

        ProjectTemplateConstraints.Capacity capacity;
        ProjectTemplateConstraints.RolePolicy policy;
        try {
            capacity = ProjectTemplateConstraints.parse(objectMapper, template, null);
            policy = ProjectTemplateConstraints.parseRolePolicy(objectMapper, template);
        } catch (RuntimeException invalidTemplate) {
            return List.of(issue(
                    team,
                    ERR_TEAM_TEMPLATE_INVALID,
                    "Cấu hình đề bài dự án không hợp lệ: " + invalidTemplate.getMessage(),
                    List.of(),
                    List.of()));
        }

        List<ProjectMember> assignments =
                memberRepository.findAllByTeam_IdOrderByIdAsc(team.getId());
        List<AllocationReadinessResponse.TeamReadinessIssue> issues = new ArrayList<>();

        if (!capacity.accepts(assignments.size())) {
            issues.add(issue(
                    team,
                    ERR_TEAM_CAPACITY_EXCEEDED,
                    "Sĩ số " + assignments.size() + " không nằm trong khoảng "
                            + capacity.window() + " thành viên của đề bài.",
                    List.of(),
                    List.of()));
        }

        List<Long> membersWithoutRole = assignments.stream()
                .filter(assignment -> !ProjectMemberRole.isValidSpec(assignment.getRole()))
                .map(assignment -> assignment.getClassMember().getId())
                .toList();
        if (!membersWithoutRole.isEmpty()) {
            issues.add(issue(
                    team,
                    ERR_TEAM_ROLE_REQUIRED,
                    "Còn " + membersWithoutRole.size()
                            + " thành viên chưa được gán vai trò hợp lệ.",
                    membersWithoutRole,
                    List.of()));
        }

        if (!policy.allowMultiRole()) {
            List<Long> multiRoleMemberIds = assignments.stream()
                    .filter(assignment ->
                            ProjectMemberRole.parseRoles(assignment.getRole()).size() > 1)
                    .map(assignment -> assignment.getClassMember().getId())
                    .toList();
            if (!multiRoleMemberIds.isEmpty()) {
                issues.add(issue(
                        team,
                        ERR_MULTI_ROLE_NOT_ALLOWED,
                        "Đề bài dự án không cho phép kiêm nhiệm vai trò nhưng có "
                                + multiRoleMemberIds.size()
                                + " thành viên đang giữ nhiều vai trò.",
                        multiRoleMemberIds,
                        List.of()));
            }
        }

        Map<String, Integer> roleCounts = new HashMap<>();
        for (ProjectMember assignment : assignments) {
            ProjectMemberRole.parseRoles(assignment.getRole())
                    .forEach(role -> roleCounts.merge(role, 1, Integer::sum));
        }
        List<TeamRoleQuotaViolation> violations = new ArrayList<>();
        for (ProjectTemplateConstraints.RoleQuota quota : policy.quotas()) {
            int actual = roleCounts.getOrDefault(quota.role(), 0);
            if (actual < quota.min()) {
                violations.add(new TeamRoleQuotaViolation(
                        quota.role(),
                        TeamRoleQuotaViolation.MISSING_REQUIRED_ROLE,
                        quota.min(),
                        actual));
            } else if (quota.hasUpperBound() && actual > quota.max()) {
                violations.add(new TeamRoleQuotaViolation(
                        quota.role(),
                        TeamRoleQuotaViolation.ROLE_QUOTA_EXCEEDED,
                        quota.max(),
                        actual));
            }
        }
        if (!violations.isEmpty()) {
            issues.add(issue(
                    team,
                    ERR_TEAM_ROLE_QUOTA_NOT_MET,
                    "Cấu hình vai trò chưa đáp ứng định suất của đề bài.",
                    List.of(),
                    violations));
        }

        return issues;
    }

    private AllocationReadinessResponse.TeamReadinessIssue issue(
            ProjectTeam team,
            String code,
            String message,
            List<Long> memberIds,
            List<TeamRoleQuotaViolation> violations
    ) {
        return new AllocationReadinessResponse.TeamReadinessIssue(
                team.getId(),
                team.getTeamName(),
                code,
                message,
                memberIds == null ? List.of() : List.copyOf(memberIds),
                violations == null ? List.of() : List.copyOf(violations));
    }
}
