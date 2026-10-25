package com.example.starter_project_2025.system.project;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
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
                    .findByCodeAndIsActiveTrue("MANUAL-GROUPING-DEFAULT")
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
        return AllocationSessionResponse.from(saved);
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
        return sessionRepository.findAllByTrainingClass_IdOrderByCreatedAtDesc(classId)
                .stream()
                .map(AllocationSessionResponse::from)
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

        return AllocationSessionResponse.from(saved);
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
        draftTeams.forEach(team -> team.setMaxMembers(requestedCapacity));
        teamRepository.saveAllAndFlush(draftTeams);
        TeamAllocationSession saved = sessionRepository.saveAndFlush(session);
        return AllocationSessionResponse.from(saved);
    }

    private int readMaxMembers(ProjectTemplate template) {
        try {
            JsonNode constraints = objectMapper.readTree(template.getConstraintsJson());
            JsonNode maxMembersNode = constraints.get("max_members");

            if (maxMembersNode == null || !maxMembersNode.canConvertToInt()) {
                throw new BadRequestException(
                        "Project template constraints must contain integer max_members");
            }

            int maxMembers = maxMembersNode.asInt();
            if (maxMembers <= 0) {
                throw new BadRequestException(
                        "Project template max_members must be greater than zero");
            }

            return maxMembers;
        } catch (com.fasterxml.jackson.core.JsonProcessingException exception) {
            throw new BadRequestException("Project template constraints contain invalid JSON");
        }
    }
}