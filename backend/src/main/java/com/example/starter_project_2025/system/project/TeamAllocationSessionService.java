package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.web.CorrelationIdFilter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.project.template.ProjectTemplateStatus;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class TeamAllocationSessionService {

    private final TrainingClassRepository trainingClassRepository;
    private final ProjectTemplateRepository projectTemplateRepository;
    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public AllocationSessionResponse openSession(
            Long classId,
            OpenAllocationSessionRequest request,
            Authentication authentication
    ) {
        TrainingClass trainingClass = trainingClassRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TrainingClass", "id", classId));

        scopeAuthorizationService.assertCanManageClass(authentication, trainingClass);

        Long requestedTemplateId = request.projectTemplateId();
        Long defaultTemplateId = trainingClass.getProjectTemplate() == null
                ? null
                : trainingClass.getProjectTemplate().getId();

        Long selectedTemplateId = requestedTemplateId != null
                ? requestedTemplateId
                : defaultTemplateId;

        ProjectTemplate template;
        if (selectedTemplateId == null) {
            template = projectTemplateRepository
                    .findByCodeAndTenantIdIsNullAndIsActiveTrue("MANUAL-GROUPING-DEFAULT")
                    .orElseGet(() -> projectTemplateRepository.saveAndFlush(
                            ProjectTemplate.builder()
                                    .code("MANUAL-GROUPING-DEFAULT")
                                    .name("Manual Team Allocation")
                                    .constraintsJson("{\"max_members\":5}")
                                    .build()));
        } else {
            template = projectTemplateRepository
                    .findByIdAndIsActiveTrue(selectedTemplateId)
                    .orElseThrow(() -> new ResourceNotFoundException(
                            "Active ProjectTemplate", "id", selectedTemplateId));
        }

        // A template explicitly selected for a team session must be ACTIVE,
        // including shared catalogue rows. The implicit manual-grouping default
        // is not a team assignment and may stay DRAFT.
        if (selectedTemplateId != null && template.getStatus() != ProjectTemplateStatus.ACTIVE) {
            throw new ResourceNotFoundException("Available ProjectTemplate", "id", selectedTemplateId);
        }
        if (template.getTenantId() != null && !template.getTenantId().equals(trainingClass.getTenantId())) {
            throw new ResourceNotFoundException("Available ProjectTemplate", "id", selectedTemplateId);
        }

        int maxMembers = request.maxMembers() != null
                ? request.maxMembers()
                : readMaxMembers(template);

        if (maxMembers <= 0) {
            throw new BadRequestException("maxMembers must be greater than zero");
        }

        TeamAllocationSession session = TeamAllocationSession.builder()
                .trainingClass(trainingClass)
                .projectTemplate(template)
                .maxMembers(maxMembers)
                .status(TeamAllocationSessionStatus.OPEN)
                .build();

        TeamAllocationSession saved = sessionRepository.saveAndFlush(session);
        return AllocationSessionResponse.from(saved,
                Math.toIntExact(sessionRepository.countByTrainingClass_Id(classId)));
    }

    @Transactional(readOnly = true)
    public List<AllocationSessionResponse> getSessions(
            Long classId,
            Authentication authentication
    ) {
        TrainingClass trainingClass = trainingClassRepository.findById(classId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TrainingClass", "id", classId));
        scopeAuthorizationService.assertCanManageTeamMentor(authentication, trainingClass);
        List<TeamAllocationSession> sessions =
                sessionRepository.findAllByTrainingClass_IdOrderByCreatedAtDescIdDesc(classId);
        int total = sessions.size();
        return java.util.stream.IntStream.range(0, total)
                .mapToObj(index -> AllocationSessionResponse.from(
                        sessions.get(index), total - index))
                .toList();
    }

    @Transactional
    public AllocationSessionResponse cancelSession(
            Long classId,
            Long sessionId,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        scopeAuthorizationService.assertCanManageClass(
                authentication, session.getTrainingClass());

        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            throw new AllocationSessionConflictException(
                    "Chỉ có thể hủy phiên đang ở trạng thái OPEN.");
        }

        List<ProjectTeam> teams =
                teamRepository.findAllByAllocationSession_IdOrderByIdAsc(sessionId);
        if (teams.stream().anyMatch(team -> team.getStatus() != ProjectTeamStatus.DRAFT)) {
            throw new AllocationSessionConflictException(
                    "Không thể hủy phiên vì có nhóm không ở trạng thái DRAFT.");
        }

        SessionState beforeState = sessionState(session, teams);
        teams.forEach(team -> team.setStatus(ProjectTeamStatus.ARCHIVED));
        teamRepository.saveAllAndFlush(teams);
        session.setStatus(TeamAllocationSessionStatus.CANCELLED);
        TeamAllocationSession saved = sessionRepository.saveAndFlush(session);
        SessionState afterState = sessionState(saved, teams);

        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        Long actorId = ((UserPrincipal) authentication.getPrincipal())
                .getUser().getId();
        String beforeJson = serialize(beforeState);
        String afterJson = serialize(afterState);
        auditRepository.save(ProjectTeamAudit.builder()
                .action("CANCEL_ALLOCATION_SESSION")
                .actorId(actorId)
                .classId(classId)
                .allocationSessionId(sessionId)
                .beforeState(beforeJson)
                .afterState(afterJson)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType("ALLOCATION_SESSION_CANCELLED")
                .aggregateId(sessionId)
                .payload(afterJson)
                .correlationId(correlationId)
                .status("PENDING")
                .build());

        return responseFor(saved);
    }

    private SessionState sessionState(
            TeamAllocationSession session,
            List<ProjectTeam> teams
    ) {
        return new SessionState(
                session.getId(),
                session.getTrainingClass().getId(),
                session.getStatus(),
                session.getMaxMembers(),
                teams.stream()
                        .map(team -> new TeamState(
                                team.getId(),
                                team.getTeamName(),
                                team.getStatus()))
                        .toList()
        );
    }

    private String serialize(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new IllegalStateException(
                    "Failed to serialize allocation session state", exception);
        }
    }

    private record SessionState(
            Long sessionId,
            Long classId,
            TeamAllocationSessionStatus status,
            Integer maxMembers,
            List<TeamState> teams
    ) {
    }

    private record TeamState(
            Long teamId,
            String teamName,
            ProjectTeamStatus status
    ) {
    }

    @Transactional
    public AllocationSessionResponse updateMaxMembers(
            Long classId,
            Long sessionId,
            UpdateAllocationSessionRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));

        scopeAuthorizationService.assertCanManageClass(
                authentication, session.getTrainingClass());

        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            throw new BadRequestException(
                    "Only an open allocation session can be edited");
        }

        int requestedCapacity = request.maxMembers();
        List<ProjectTeam> draftTeams =
                teamRepository.findAllByAllocationSession_IdAndStatus(
                        sessionId, ProjectTeamStatus.DRAFT);
        for (ProjectTeam team : draftTeams) {
            if (projectMemberRepository.countByTeam_Id(team.getId()) > requestedCapacity) {
                throw new TeamCapacityExceededException(requestedCapacity);
            }
        }

        session.setMaxMembers(requestedCapacity);
        // US-10: teams that already carry a project template keep the capacity
        // window of that template; only untemplated drafts follow the session.
        draftTeams.stream()
                .filter(team -> team.getProjectTemplateId() == null)
                .forEach(team -> team.setMaxMembers(requestedCapacity));
        teamRepository.saveAllAndFlush(draftTeams);
        TeamAllocationSession saved = sessionRepository.saveAndFlush(session);
        return responseFor(saved);
    }

    private AllocationSessionResponse responseFor(TeamAllocationSession session) {
        List<TeamAllocationSession> sessions =
                sessionRepository.findAllByTrainingClass_IdOrderByCreatedAtDescIdDesc(
                        session.getTrainingClass().getId());
        int index = java.util.stream.IntStream.range(0, sessions.size())
                .filter(position -> sessions.get(position).getId().equals(session.getId()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "Saved allocation session was not found in its class session list"));
        return AllocationSessionResponse.from(session, sessions.size() - index);
    }

    private int readMaxMembers(ProjectTemplate template) {
        // US-10: the capacity window is owned by ProjectTemplateConstraints so
        // the session and the team assignment share one parser.
        return ProjectTemplateConstraints.parse(objectMapper, template, null).maxMembers();
    }
}
