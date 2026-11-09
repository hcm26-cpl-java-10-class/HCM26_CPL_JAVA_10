package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.OptimisticLockException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-11 — configure and validate team member roles.
 *
 * <p>Rules:</p>
 * <ul>
 *     <li>Every member must hold at least one valid role ({@link ProjectMemberRole}).</li>
 *     <li>When the assigned project template declares {@code allow_multi_role =
 *     false}, a member can hold exactly one role.</li>
 *     <li>The role counts must satisfy the template {@code role_quotas} minimum
 *     (and maximum, when declared). Missing mandatory seats are reported with
 *     HTTP 422 {@code ERR_TEAM_ROLE_QUOTA_NOT_MET} and a per-role breakdown.</li>
 *     <li>Role changes are traced in the append-only team member history plus the
 *     team audit log / outbox.</li>
 * </ul>
 */
@Service
@RequiredArgsConstructor
public class ProjectTeamRoleService {

    private static final String TEAM_LEADER_ROLE = "PM";

    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository memberRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ProjectTeamMemberHistoryService historyService;
    private final EntityManager entityManager;
    private final ObjectMapper objectMapper;

    // ------------------------------------------------------------------
    // Mentor / Program Manager
    // ------------------------------------------------------------------

    @Transactional
    public void updateRoles(
            Long classId,
            Long sessionId,
            Long teamId,
            UpdateTeamRolesRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        scopeAuthorizationService.assertCanManageTeamMentor(
                authentication, session.getTrainingClass());
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN
                && session.getStatus() != TeamAllocationSessionStatus.PUBLISHED) {
            throw new BadRequestException(
                    "Phiên phân nhóm hiện không cho phép cập nhật vai trò");
        }

        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));
        if (team.getStatus() != ProjectTeamStatus.DRAFT
                && team.getStatus() != ProjectTeamStatus.ACTIVE) {
            throw new BadRequestException(
                    "Chỉ có thể cập nhật vai trò cho nhóm DRAFT hoặc ACTIVE");
        }

        applyRoleConfiguration(session, team, request, authentication, null);
    }

    // ------------------------------------------------------------------
    // Student (Team Leader)
    // ------------------------------------------------------------------

    /**
     * US-11: a student who is the PM (team leader) may configure the roles of
     * their own DRAFT team. The leader must keep the PM role so the team stays
     * manageable from the student workspace.
     */
    @Transactional
    public void updateRolesAsTeamLeader(
            Long teamId,
            UpdateTeamRolesRequest request,
            Authentication authentication
    ) {
        Long userId = currentUserId(authentication);
        ProjectTeam team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));

        ProjectMember membership = memberRepository
                .findByTeam_IdAndClassMember_User_Id(teamId, userId)
                .orElseThrow(() -> new AccessDeniedException(
                        "Bạn không phải thành viên của nhóm này."));
        if (!ProjectMemberRole.hasRole(membership.getRole(), TEAM_LEADER_ROLE)) {
            throw new AccessDeniedException(
                    "Chỉ Trưởng nhóm (vai trò PM) mới được cấu hình vai trò thành viên.");
        }
        if (team.getStatus() != ProjectTeamStatus.DRAFT) {
            throw new BadRequestException(
                    "Chỉ có thể cấu hình vai trò khi nhóm còn ở trạng thái DRAFT");
        }
        TeamAllocationSession session = team.getAllocationSession();
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            throw new BadRequestException(
                    "Phiên phân nhóm không còn mở để cấu hình vai trò");
        }

        applyRoleConfiguration(
                session,
                team,
                request,
                authentication,
                membership.getClassMember().getId());
    }

    // ------------------------------------------------------------------
    // Core validation + persistence
    // ------------------------------------------------------------------

    private void applyRoleConfiguration(
            TeamAllocationSession session,
            ProjectTeam team,
            UpdateTeamRolesRequest request,
            Authentication authentication,
            Long requiredLeaderMemberId
    ) {
        if (request == null || request.expectedVersion() == null) {
            throw new TeamRoleAssignmentException(
                    "Version nhóm là bắt buộc", List.of());
        }
        if (!request.expectedVersion().equals(team.getVersion())) {
            throw new TeamVersionConflictException();
        }

        List<ProjectMember> assignments =
                memberRepository.findAllByTeam_IdOrderByIdAsc(team.getId());
        Map<Long, ProjectMember> assignmentsByMemberId = new HashMap<>();
        assignments.forEach(assignment ->
                assignmentsByMemberId.put(assignment.getClassMember().getId(), assignment));

        List<Long> invalidMemberIds = new ArrayList<>();
        Map<Long, List<String>> requestedRoles = new LinkedHashMap<>();
        Set<Long> seenMemberIds = new LinkedHashSet<>();
        List<UpdateTeamRolesRequest.MemberRoleAssignment> requestedMembers =
                request.members() == null ? List.of() : request.members();

        for (UpdateTeamRolesRequest.MemberRoleAssignment member : requestedMembers) {
            if (member == null || member.memberId() == null
                    || !seenMemberIds.add(member.memberId())) {
                if (member != null && member.memberId() != null) {
                    invalidMemberIds.add(member.memberId());
                }
                continue;
            }
            List<String> rawRoles = ProjectMemberRole.rawRoles(member.resolveRoles());
            List<String> normalizedRoles = ProjectMemberRole.normalizeRoles(rawRoles);
            if (rawRoles.isEmpty()
                    || ProjectMemberRole.containsUnknownRole(rawRoles)
                    || !assignmentsByMemberId.containsKey(member.memberId())) {
                invalidMemberIds.add(member.memberId());
                continue;
            }
            requestedRoles.put(member.memberId(), normalizedRoles);
        }

        assignmentsByMemberId.keySet().stream()
                .filter(memberId -> !requestedRoles.containsKey(memberId))
                .forEach(invalidMemberIds::add);

        if (requestedMembers.size() != assignmentsByMemberId.size()
                || !invalidMemberIds.isEmpty()) {
            throw new TeamRoleAssignmentException(
                    "Vui lòng chọn vai trò hợp lệ cho từng thành viên trong nhóm",
                    invalidMemberIds.stream().distinct().toList());
        }

        validateTemplatePolicy(team, requestedRoles, requiredLeaderMemberId);

        List<ProjectMember> changedAssignments = assignments.stream()
                .filter(assignment -> !equalsRoleSpec(
                        ProjectMemberRole.formatRoles(requestedRoles.get(
                                assignment.getClassMember().getId())),
                        assignment.getRole()))
                .toList();
        if (changedAssignments.isEmpty()) {
            return;
        }

        String beforeState = serialize(snapshot(team, assignments));
        Map<Long, String> previousRoles = new HashMap<>();
        changedAssignments.forEach(assignment -> previousRoles.put(
                assignment.getClassMember().getId(), assignment.getRole()));
        try {
            entityManager.lock(team, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
            entityManager.flush();
        } catch (OptimisticLockException | OptimisticLockingFailureException conflict) {
            throw new TeamVersionConflictException();
        }

        changedAssignments.forEach(assignment -> assignment.setRole(
                ProjectMemberRole.formatRoles(requestedRoles.get(
                        assignment.getClassMember().getId()))));
        memberRepository.saveAllAndFlush(changedAssignments);
        String afterState = serialize(snapshot(team, assignments));

        // US-11: history is written for every role change, including DRAFT
        // teams, so the assignment trail is never lost.
        for (ProjectMember assignment : changedAssignments) {
            String newRole = ProjectMemberRole.formatRoles(requestedRoles.get(
                    assignment.getClassMember().getId()));
            historyService.record(
                    session,
                    assignment.getClassMember(),
                    team,
                    team,
                    previousRoles.get(assignment.getClassMember().getId()),
                    newRole,
                    "ROLE_CHANGED",
                    null,
                    authentication);
        }

        Long actorId = currentUserId(authentication);
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        auditRepository.save(ProjectTeamAudit.builder()
                .action("UPDATE_TEAM_MEMBER_ROLES")
                .actorId(actorId)
                .classId(team.getTrainingClass().getId())
                .allocationSessionId(session.getId())
                .beforeState(beforeState)
                .afterState(afterState)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType("PROJECT_TEAM_MEMBER_ROLES_UPDATED")
                .aggregateId(team.getId())
                .payload(afterState)
                .correlationId(correlationId)
                .status("PENDING")
                .build());
    }

    private void validateTemplatePolicy(
            ProjectTeam team,
            Map<Long, List<String>> requestedRoles,
            Long requiredLeaderMemberId
    ) {
        ProjectTemplate template = team.getProjectTemplate();
        ProjectTemplateConstraints.RolePolicy policy = template == null
                ? ProjectTemplateConstraints.RolePolicy.singleRoleDefault()
                : ProjectTemplateConstraints.parseRolePolicy(objectMapper, template);

        if (!policy.allowMultiRole()) {
            List<Long> multiRoleMemberIds = requestedRoles.entrySet().stream()
                    .filter(entry -> entry.getValue().size() > 1)
                    .map(Map.Entry::getKey)
                    .toList();
            if (!multiRoleMemberIds.isEmpty()) {
                throw TeamRolePolicyException.multiRoleNotAllowed(multiRoleMemberIds);
            }
        }

        Map<String, Integer> counts = new HashMap<>();
        requestedRoles.values().forEach(roles ->
                roles.forEach(role -> counts.merge(role, 1, Integer::sum)));

        List<TeamRoleQuotaViolation> violations = new ArrayList<>();
        for (ProjectTemplateConstraints.RoleQuota quota : policy.quotas()) {
            int actual = counts.getOrDefault(quota.role(), 0);
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
            throw TeamRolePolicyException.quotaNotMet(
                    buildQuotaMessage(violations), violations);
        }

        if (requiredLeaderMemberId != null) {
            List<String> leaderRoles = requestedRoles.get(requiredLeaderMemberId);
            if (leaderRoles == null || !leaderRoles.contains(TEAM_LEADER_ROLE)) {
                throw TeamRolePolicyException.leaderRoleRequired(requiredLeaderMemberId);
            }
        }
    }

    private String buildQuotaMessage(List<TeamRoleQuotaViolation> violations) {
        List<String> missing = violations.stream()
                .filter(violation -> TeamRoleQuotaViolation.MISSING_REQUIRED_ROLE
                        .equals(violation.reason()))
                .map(violation -> violation.role() + " (cần tối thiểu "
                        + violation.required() + ", hiện có " + violation.actual() + ")")
                .toList();
        List<String> exceeded = violations.stream()
                .filter(violation -> TeamRoleQuotaViolation.ROLE_QUOTA_EXCEEDED
                        .equals(violation.reason()))
                .map(violation -> violation.role() + " (tối đa "
                        + violation.required() + ", hiện có " + violation.actual() + ")")
                .toList();

        StringBuilder message = new StringBuilder(
                "Cấu hình vai trò chưa đáp ứng định suất của đề bài");
        if (!missing.isEmpty()) {
            message.append(". Còn thiếu vai trò bắt buộc: ")
                    .append(String.join(", ", missing));
        }
        if (!exceeded.isEmpty()) {
            message.append(". Vượt định suất: ")
                    .append(String.join(", ", exceeded));
        }
        return message.toString();
    }

    private boolean equalsRoleSpec(String left, String right) {
        return ProjectMemberRole.parseRoles(left)
                .equals(ProjectMemberRole.parseRoles(right));
    }

    private TeamSnapshot snapshot(ProjectTeam team, List<ProjectMember> assignments) {
        return new TeamSnapshot(
                team.getId(),
                team.getVersion(),
                assignments.stream()
                        .map(assignment -> new MemberRoleSnapshot(
                                assignment.getClassMember().getId(),
                                assignment.getRole()))
                        .toList());
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize team role state", exception);
        }
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication == null
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Yêu cầu đăng nhập để cấu hình vai trò.");
        }
        return principal.getUser().getId();
    }

    private record TeamSnapshot(
            Long teamId,
            Long version,
            List<MemberRoleSnapshot> members
    ) {
    }

    private record MemberRoleSnapshot(Long memberId, String role) {
    }
}
