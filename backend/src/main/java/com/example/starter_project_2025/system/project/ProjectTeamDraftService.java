package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.web.CorrelationIdFilter;

import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.time.Duration;
import java.time.Instant;
import java.util.UUID;
import org.slf4j.MDC;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectTeamDraftService {

    private final TeamAllocationSessionRepository sessionRepository;
    private final ClassMemberRepository classMemberRepository;
    private final ProjectTeamRepository teamRepository;
    private final ProjectMemberRepository projectMemberRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final IdempotencyRecordRepository idempotencyRecordRepository;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;
    private final ProjectTeamMentorService teamMentorService;
    private final EntityManager entityManager;

    @Transactional
    public BatchSaveDraftResponse saveBatch(
            Long sessionId,
            BatchSaveDraftRequest request,
            Authentication authentication,
            Long idempotencyRecordId
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));

        scopeAuthorizationService.assertCanManageClass(
                authentication, session.getTrainingClass());

        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            throw new BadRequestException("Allocation session is not open");
        }

        Long classId = session.getTrainingClass().getId();
        List<Long> requestedMemberIds = request.teams().stream()
                .flatMap(team -> team.members().stream())
                .map(BatchSaveDraftRequest.MemberAssignmentRequest::memberId)
                .toList();

        validateNoDuplicateWithinTeam(request);

        for (BatchSaveDraftRequest.TeamDraftRequest team : request.teams()) {
            if (team.members().size() > session.getMaxMembers()) {
                throw new TeamCapacityExceededException(session.getMaxMembers());
            }
        }

        Set<Long> distinctMemberIds = new HashSet<>(requestedMemberIds);
        List<ClassMember> members = classMemberRepository
                .findAllByTrainingClass_IdAndIdInAndStatus(
                        classId,
                        distinctMemberIds.stream().toList(),
                        ClassMemberStatus.ACTIVE);

        Map<Long, ClassMember> membersById = new HashMap<>();
        members.forEach(member -> membersById.put(member.getId(), member));

        if (membersById.size() != distinctMemberIds.size()) {
            throw new BadRequestException(
                    "One or more members are not ACTIVE members of this class");
        }

        request.teams().forEach(team ->
                teamMentorService.validateMentor(
                        session.getTrainingClass(), team.assignedMentorId()));

        List<ProjectTeam> newTeams = new ArrayList<>();
        for (BatchSaveDraftRequest.TeamDraftRequest teamRequest : request.teams()) {
            newTeams.add(ProjectTeam.builder()
                    .trainingClass(session.getTrainingClass())
                    .allocationSession(session)
                    .teamName(teamRequest.teamName().trim())
                    .assignedMentorId(teamRequest.assignedMentorId())
                    .maxMembers(session.getMaxMembers())
                    .status(ProjectTeamStatus.DRAFT)
                    .build());
        }

        teamRepository.saveAllAndFlush(newTeams);

        List<ProjectMember> newMembers = new ArrayList<>();
        for (int teamIndex = 0; teamIndex < request.teams().size(); teamIndex++) {
            ProjectTeam team = newTeams.get(teamIndex);
            BatchSaveDraftRequest.TeamDraftRequest teamRequest =
                    request.teams().get(teamIndex);

            for (BatchSaveDraftRequest.MemberAssignmentRequest assignment
                    : teamRequest.members()) {
                newMembers.add(ProjectMember.builder()
                        .team(team)
                        .classMember(membersById.get(assignment.memberId()))
                        .role(defaultRole(assignment.role()))
                        .build());
            }
        }
        projectMemberRepository.saveAllAndFlush(newMembers);

        List<BatchSaveDraftResponse.DraftWarning> warnings =
                buildDraftWarnings(
                        session,
                        distinctMemberIds,
                        newTeams,
                        newMembers,
                        membersById
                );

        BatchSaveDraftResponse response =
                buildResponse(session, newTeams, newMembers, warnings);

        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        String responseJson = writeJson(response);
        String afterState = writeJson(new TeamBatchSnapshot(
                session.getId(),
                classId,
                session.getTrainingClass().getCohortId(),
                session.getTrainingClass().getTenantId(),
                newTeams.stream()
                        .map(team -> new TeamSnapshot(
                                team.getId(),
                                team.getTeamName(),
                                team.getProjectId(),
                                team.getMaxMembers(),
                                team.getStatus(),
                                team.getAssignedMentorId(),
                                newMembers.stream()
                                        .filter(member -> member.getTeam().getId().equals(team.getId()))
                                        .map(member -> new MemberSnapshot(
                                                member.getClassMember().getId(),
                                                member.getRole()))
                                        .toList()))
                        .toList()
        ));

        auditRepository.save(ProjectTeamAudit.builder()
                .action("BATCH_CREATE_DRAFT")
                .actorId(actorId)
                .classId(classId)
                .allocationSessionId(sessionId)
                .beforeState(null)
                .afterState(afterState)
                .correlationId(correlationId)
                .build());

        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType("PROJECT_TEAMS_DRAFT_SAVED")
                .aggregateId(sessionId)
                .payload(afterState)
                .correlationId(correlationId)
                .status("PENDING")
                .build());

        IdempotencyRecord idempotencyRecord = idempotencyRecordRepository
                .findById(idempotencyRecordId)
                .orElseThrow(() -> new IllegalStateException(
                        "Idempotency record not found: " + idempotencyRecordId));
        idempotencyRecord.setStatus(IdempotencyStatus.COMPLETED);
        idempotencyRecord.setHttpStatus(200);
        idempotencyRecord.setResponseBody(responseJson);
        idempotencyRecord.setExpiresAt(Instant.now().plus(Duration.ofHours(24)));

        return response;
    }

    @Transactional
    public void updateDraftTeam(
            Long classId,
            Long sessionId,
            Long teamId,
            UpdateDraftTeamRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .filter(value -> value.getTrainingClass().getId().equals(classId))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        scopeAuthorizationService.assertCanManageClass(
                authentication, session.getTrainingClass());
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            throw new BadRequestException("Allocation session is not open");
        }

        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("ProjectTeam", "id", teamId));
        if (team.getStatus() != ProjectTeamStatus.DRAFT) {
            throw new BadRequestException("Only DRAFT teams can be edited");
        }

        List<UpdateDraftTeamRequest.MemberRequest> assignments =
                request.members() == null ? List.of() : request.members();
        if (assignments.size() > session.getMaxMembers()) {
            throw new TeamCapacityExceededException(session.getMaxMembers());
        }
        Set<Long> memberIds = new HashSet<>();
        for (UpdateDraftTeamRequest.MemberRequest assignment : assignments) {
            if (!memberIds.add(assignment.memberId())) {
                throw new BadRequestException("A member cannot appear twice in the same team");
            }
        }

        Map<Long, ClassMember> membersById = new HashMap<>();
        if (!memberIds.isEmpty()) {
            classMemberRepository.findAllByTrainingClass_IdAndIdInAndStatus(
                            classId, memberIds.stream().toList(), ClassMemberStatus.ACTIVE)
                    .forEach(member -> membersById.put(member.getId(), member));
        }
        if (membersById.size() != memberIds.size()) {
            throw new BadRequestException(
                    "One or more members are not ACTIVE members of this class");
        }
        teamMentorService.validateMentor(
                session.getTrainingClass(), request.assignedMentorId());
        List<ProjectMember> oldMembers =
                projectMemberRepository.findAllByTeam_IdOrderByIdAsc(teamId);
        String beforeState = writeJson(new TeamSnapshot(
                team.getId(),
                team.getTeamName(),
                team.getProjectId(),
                team.getMaxMembers(),
                team.getStatus(),
                team.getAssignedMentorId(),
                oldMembers.stream()
                        .map(member -> new MemberSnapshot(
                                member.getClassMember().getId(), member.getRole()))
                        .toList()));

        entityManager.lock(team, LockModeType.OPTIMISTIC_FORCE_INCREMENT);
        entityManager.flush();
        team.setTeamName(request.teamName().trim());
        team.setAssignedMentorId(request.assignedMentorId());
        teamRepository.saveAndFlush(team);
        projectMemberRepository.deleteAllByTeam_Id(teamId);
        projectMemberRepository.flush();
        List<ProjectMember> newMembers = new ArrayList<>();
        for (UpdateDraftTeamRequest.MemberRequest assignment : assignments) {
            newMembers.add(ProjectMember.builder()
                    .team(team)
                    .classMember(membersById.get(assignment.memberId()))
                    .role(defaultRole(assignment.role()))
                    .build());
        }
        projectMemberRepository.saveAllAndFlush(newMembers);

        String afterState = writeJson(new TeamSnapshot(
                team.getId(),
                team.getTeamName(),
                team.getProjectId(),
                team.getMaxMembers(),
                team.getStatus(),
                team.getAssignedMentorId(),
                newMembers.stream()
                        .map(member -> new MemberSnapshot(
                                member.getClassMember().getId(), member.getRole()))
                        .toList()));
        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        auditRepository.save(ProjectTeamAudit.builder()
                .action("UPDATE_DRAFT_TEAM")
                .actorId(actorId)
                .classId(classId)
                .allocationSessionId(sessionId)
                .beforeState(beforeState)
                .afterState(afterState)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType("PROJECT_TEAM_DRAFT_UPDATED")
                .aggregateId(teamId)
                .payload(afterState)
                .correlationId(correlationId)
                .status("PENDING")
                .build());
    }

    private record TeamBatchSnapshot(
            Long allocationSessionId,
            Long classId,
            Long cohortId,
            Long tenantId,
            List<TeamSnapshot> teams
    ) {
    }

    private record TeamSnapshot(
            Long teamId,
            String teamName,
            Long projectId,
            Integer maxMembers,
            ProjectTeamStatus status,
            Long assignedMentorId,
            List<MemberSnapshot> members
    ) {
    }

    private record MemberSnapshot(Long memberId, String role) {
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize project team state", exception);
        }
    }

    private void validateNoDuplicateWithinTeam(BatchSaveDraftRequest request) {
        for (BatchSaveDraftRequest.TeamDraftRequest team : request.teams()) {
            Set<Long> ids = new HashSet<>();
            for (BatchSaveDraftRequest.MemberAssignmentRequest member : team.members()) {
                if (!ids.add(member.memberId())) {
                    throw new BadRequestException(
                            "A member cannot appear twice in the same team");
                }
            }
        }
    }

    private String defaultRole(String role) {
        return role == null || role.isBlank() ? ProjectMemberRole.DEV.name() : role;
    }

    private BatchSaveDraftResponse buildResponse(
            TeamAllocationSession session,
            List<ProjectTeam> teams,
            List<ProjectMember> members,
            List<BatchSaveDraftResponse.DraftWarning> warnings
    ) {
        Map<Long, List<Long>> memberIdsByTeam = new HashMap<>();
        Map<Long, List<BatchSaveDraftResponse.MemberResponse>> membersByTeam =
                new HashMap<>();

        for (ProjectMember member : members) {
            memberIdsByTeam.computeIfAbsent(
                    member.getTeam().getId(),
                    ignored -> new ArrayList<>()
            ).add(member.getClassMember().getId());
            membersByTeam.computeIfAbsent(
                    member.getTeam().getId(),
                    ignored -> new ArrayList<>()
            ).add(new BatchSaveDraftResponse.MemberResponse(
                    member.getClassMember().getId(),
                    member.getClassMember().getUser().getFullName(),
                    member.getRole()
            ));
        }

        List<BatchSaveDraftResponse.TeamResponse> teamResponses = teams.stream()
                .map(team -> new BatchSaveDraftResponse.TeamResponse(
                        team.getId(),
                        team.getTeamName(),
                        team.getStatus(),
                        team.getAssignedMentorId(),
                        teamMentorService.getMentorName(team.getAssignedMentorId()),
                        team.getVersion(),
                        memberIdsByTeam.getOrDefault(team.getId(), List.of()),
                        membersByTeam.getOrDefault(team.getId(), List.of()),
                        team.getProjectTemplateId(),
                        team.getProjectTemplateName(),
                        null,
                        null,
                        memberIdsByTeam.getOrDefault(team.getId(), List.of()).size()
                ))
                .toList();

        return new BatchSaveDraftResponse(
                "SUCCESS",
                session.getId(),
                teamResponses,
                warnings
        );
    }

    private List<BatchSaveDraftResponse.DraftWarning> buildDraftWarnings(
            TeamAllocationSession session,
            Set<Long> memberIds,
            List<ProjectTeam> newTeams,
            List<ProjectMember> newMembers,
            Map<Long, ClassMember> membersById
    ) {
        Map<Long, Map<Long, String>> teamsByMember = new HashMap<>();

        List<ProjectMember> existingDraftAssignments = memberIds.isEmpty()
                ? List.of()
                : projectMemberRepository.findMembersBySessionAndTeamStatus(
                        memberIds,
                        session.getId(),
                        ProjectTeamStatus.DRAFT
                );

        for (ProjectMember assignment : existingDraftAssignments) {
            addTeamForMember(
                    teamsByMember,
                    assignment.getClassMember().getId(),
                    assignment.getTeam()
            );
        }

        for (ProjectMember assignment : newMembers) {
            addTeamForMember(
                    teamsByMember,
                    assignment.getClassMember().getId(),
                    assignment.getTeam()
            );
        }

        List<BatchSaveDraftResponse.DraftWarning> warnings = new ArrayList<>();

        for (Map.Entry<Long, Map<Long, String>> entry : teamsByMember.entrySet()) {
            if (entry.getValue().size() < 2) {
                continue;
            }

            Long memberId = entry.getKey();
            ClassMember member = membersById.get(memberId);
            String memberName = member.getUser().getFullName();

            List<Long> conflictingTeamIds = entry.getValue().keySet().stream()
                    .sorted()
                    .toList();

            List<String> conflictingTeamNames = conflictingTeamIds.stream()
                    .map(entry.getValue()::get)
                    .toList();

            warnings.add(new BatchSaveDraftResponse.DraftWarning(
                    "WARN_STUDENT_DUPLICATED_IN_DRAFT",
                    memberId,
                    memberName,
                    conflictingTeamIds,
                    conflictingTeamNames,
                    "Học viên " + memberName
                            + " đang nằm trong nhiều nhóm nháp của phiên xếp nhóm này."
            ));
        }

        return warnings;
    }

    private void addTeamForMember(
            Map<Long, Map<Long, String>> teamsByMember,
            Long memberId,
            ProjectTeam team
    ) {
        teamsByMember.computeIfAbsent(memberId, ignored -> new HashMap<>())
                .put(team.getId(), team.getTeamName());
    }
}
