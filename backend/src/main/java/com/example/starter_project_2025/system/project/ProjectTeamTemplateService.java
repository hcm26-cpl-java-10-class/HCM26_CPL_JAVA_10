package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.web.CorrelationIdFilter;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * US-10 — assign a project template (đề bài) to a team that is still in
 * {@link ProjectTeamStatus#DRAFT}.
 *
 * <p>Rules implemented here:</p>
 * <ul>
 *     <li>Only {@code DRAFT} teams accept a template ({@link TeamNotDraftException}).</li>
 *     <li>The current team size ({@code count(members)}) must satisfy
 *     {@code min_members <= count <= max_members} of the selected template
 *     ({@link TeamTemplateCapacityExceededException}, HTTP 400
 *     {@code ERR_TEAM_CAPACITY_EXCEEDED}).</li>
 *     <li>A successful assignment writes {@code project_template_id} on the
 *     team, stores an audit row and enqueues an outbox event.</li>
 * </ul>
 *
 * <p>Scope checks are performed by the callers: the mentor / program-manager
 * endpoint goes through {@link ScopeAuthorizationService}, the team-leader
 * endpoint validates membership ownership.</p>
 */
@Service
@RequiredArgsConstructor
public class ProjectTeamTemplateService {

    public static final String AUDIT_ACTION = "ASSIGN_TEAM_PROJECT_TEMPLATE";
    public static final String OUTBOX_EVENT = "PROJECT_TEAM_TEMPLATE_ASSIGNED";

    /** Team roles use PM for the team leader. */
    private static final String TEAM_LEADER_ROLE = "PM";

    private final ProjectTemplateRepository projectTemplateRepository;
    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ObjectMapper objectMapper;

    // ------------------------------------------------------------------
    // Read
    // ------------------------------------------------------------------

    /**
     * Templates that can be assigned, ordered by name. Only active rows are
     * returned; a template without a readable capacity window is skipped
     * instead of breaking the whole list.
     */
    @Transactional(readOnly = true)
    public List<ProjectTemplateOptionResponse> getAssignableTemplates() {
        return projectTemplateRepository.findAll().stream()
                .filter(template -> Boolean.TRUE.equals(template.getIsActive()))
                .sorted(Comparator.comparing(
                        template -> template.getName() == null ? "" : template.getName()))
                .map(this::toOption)
                .flatMap(Optional::stream)
                .toList();
    }

    /** US-10 read model for the mentor / program-manager screen. */
    @Transactional(readOnly = true)
    public TeamProjectTemplateResponse getTeamTemplate(
            Long classId,
            Long sessionId,
            Long teamId,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findById(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        scopeAuthorizationService.assertCanManageTeamMentor(
                authentication, session.getTrainingClass());

        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));
        return toTeamResponse(team);
    }

    /** US-10 read model for the student team leader screen. */
    @Transactional(readOnly = true)
    public List<TeamProjectTemplateResponse> getMyDraftTeams(Authentication authentication) {
        Long userId = currentUserId(authentication);
        return projectMemberRepository
                .findLeaderTeams(
                        userId,
                        ClassMemberStatus.ACTIVE,
                        ProjectTeamStatus.DRAFT,
                        TEAM_LEADER_ROLE)
                .stream()
                .map(member -> toTeamResponse(member.getTeam()))
                .toList();
    }

    // ------------------------------------------------------------------
    // Write
    // ------------------------------------------------------------------

    /**
     * Mentor / program-manager entry point: assigns {@code projectTemplateId}
     * to a DRAFT team of an open allocation session.
     */
    @Transactional
    public TeamProjectTemplateResponse assignTemplate(
            Long classId,
            Long sessionId,
            Long teamId,
            Long projectTemplateId,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        scopeAuthorizationService.assertCanManageTeamMentor(
                authentication, session.getTrainingClass());

        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));

        ProjectTemplate template = findActiveTemplate(projectTemplateId);
        return applyAssignment(team, template, currentUserId(authentication));
    }

    /**
     * Student team-leader entry point: a student may only change the template
     * of a DRAFT team they lead.
     */
    @Transactional
    public TeamProjectTemplateResponse assignTemplateAsTeamLeader(
            Long teamId,
            Long projectTemplateId,
            Authentication authentication
    ) {
        Long userId = currentUserId(authentication);
        ProjectTeam team = teamRepository.findById(teamId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));

        boolean isLeader = projectMemberRepository
                .findByTeam_IdAndClassMember_User_Id(teamId, userId)
                .map(member -> ProjectMemberRole.hasRole(member.getRole(), TEAM_LEADER_ROLE))
                .orElse(false);
        if (!isLeader) {
            throw new AccessDeniedException(
                    "Chỉ Trưởng nhóm (vai trò PM) của nhóm mới được gán đề bài.");
        }

        ProjectTemplate template = findActiveTemplate(projectTemplateId);
        return applyAssignment(team, template, userId);
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    private TeamProjectTemplateResponse applyAssignment(
            ProjectTeam team,
            ProjectTemplate template,
            Long actorId
    ) {
        if (team.getStatus() != ProjectTeamStatus.DRAFT) {
            throw new TeamNotDraftException(team.getId(), team.getStatus());
        }

        ProjectTemplateConstraints.Capacity capacity =
                ProjectTemplateConstraints.parse(objectMapper, template, null);
        int memberCount = (int) projectMemberRepository.countByTeam_Id(team.getId());

        if (memberCount > capacity.maxMembers()) {
            throw TeamTemplateCapacityExceededException.exceeded(
                    memberCount, capacity, template);
        }
        if (memberCount < capacity.minMembers()) {
            throw TeamTemplateCapacityExceededException.notMet(
                    memberCount, capacity, template);
        }

        Long previousTemplateId = team.getProjectTemplateId();
        String previousTemplateName = team.getProjectTemplateName();

        team.setProjectTemplate(template);
        // Keep the per-team capacity in sync with the template window so adding
        // members later cannot break the rule that was just validated.
        team.setMaxMembers(capacity.maxMembers());
        teamRepository.saveAndFlush(team);

        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }

        TeamTemplateAuditState before = new TeamTemplateAuditState(
                team.getId(),
                team.getTeamName(),
                previousTemplateId,
                previousTemplateName,
                null,
                null,
                null);
        TeamTemplateAuditState after = new TeamTemplateAuditState(
                team.getId(),
                team.getTeamName(),
                template.getId(),
                template.getName(),
                capacity.minMembers(),
                capacity.maxMembers(),
                memberCount);

        String beforeJson = serialize(before);
        String afterJson = serialize(after);

        auditRepository.save(ProjectTeamAudit.builder()
                .action(AUDIT_ACTION)
                .actorId(actorId)
                .classId(team.getTrainingClass().getId())
                .allocationSessionId(team.getAllocationSession().getId())
                .beforeState(beforeJson)
                .afterState(afterJson)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType(OUTBOX_EVENT)
                .aggregateId(team.getId())
                .payload(afterJson)
                .correlationId(correlationId)
                .status("PENDING")
                .build());

        return toTeamResponse(team);
    }

    private ProjectTemplate findActiveTemplate(Long projectTemplateId) {
        if (projectTemplateId == null) {
            throw new BadRequestException("projectTemplateId is required");
        }
        return projectTemplateRepository.findByIdAndIsActiveTrue(projectTemplateId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Active ProjectTemplate", "id", projectTemplateId));
    }

    private Optional<ProjectTemplateOptionResponse> toOption(ProjectTemplate template) {
        try {
            ProjectTemplateConstraints.Capacity capacity =
                    ProjectTemplateConstraints.parse(objectMapper, template, null);
            ProjectTemplateConstraints.RolePolicy policy =
                    ProjectTemplateConstraints.parseRolePolicy(objectMapper, template);
            return Optional.of(new ProjectTemplateOptionResponse(
                    template.getId(),
                    template.getCode(),
                    template.getName(),
                    capacity.minMembers(),
                    capacity.maxMembers(),
                    policy.allowMultiRole(),
                    policy.quotas()));
        } catch (RuntimeException skipped) {
            return Optional.empty();
        }
    }

    private TeamProjectTemplateResponse toTeamResponse(ProjectTeam team) {
        int memberCount = (int) projectMemberRepository.countByTeam_Id(team.getId());
        ProjectTemplate template = team.getProjectTemplate();

        Integer minMembers = null;
        Integer maxMembers = null;
        ProjectTemplateConstraints.RolePolicy policy =
                ProjectTemplateConstraints.RolePolicy.singleRoleDefault();
        if (template != null) {
            try {
                ProjectTemplateConstraints.Capacity capacity =
                        ProjectTemplateConstraints.parse(objectMapper, template, null);
                minMembers = capacity.minMembers();
                maxMembers = capacity.maxMembers();
                policy = ProjectTemplateConstraints.parseRolePolicy(objectMapper, template);
            } catch (RuntimeException ignored) {
                // A template with broken constraints must not break reads; the
                // assign action reports the problem with a 400.
                policy = ProjectTemplateConstraints.RolePolicy.singleRoleDefault();
            }
        }

        List<ProjectMember> assignments =
                projectMemberRepository.findAllByTeam_IdOrderByIdAsc(team.getId());
        List<TeamProjectTemplateResponse.Member> members = assignments.stream()
                .map(assignment -> new TeamProjectTemplateResponse.Member(
                        assignment.getClassMember().getId(),
                        assignment.getClassMember().getUser().getFullName(),
                        ProjectMemberRole.parseRoles(assignment.getRole())))
                .toList();

        var trainingClass = team.getTrainingClass();
        return new TeamProjectTemplateResponse(
                team.getId(),
                team.getTeamName(),
                team.getStatus(),
                team.getVersion(),
                trainingClass == null ? null : trainingClass.getId(),
                trainingClass == null ? null : trainingClass.getName(),
                team.getProjectTemplateId(),
                team.getProjectTemplateName(),
                minMembers,
                maxMembers,
                memberCount,
                policy.allowMultiRole(),
                policy.quotas(),
                members);
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication == null
                || !(authentication.getPrincipal() instanceof UserPrincipal principal)) {
            throw new AccessDeniedException("Yêu cầu đăng nhập để gán đề bài.");
        }
        return principal.getUser().getId();
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Failed to serialize project template assignment state", exception);
        }
    }

    private record TeamTemplateAuditState(
            Long teamId,
            String teamName,
            Long projectTemplateId,
            String projectTemplateName,
            Integer minMembers,
            Integer maxMembers,
            Integer memberCount
    ) {
    }
}
