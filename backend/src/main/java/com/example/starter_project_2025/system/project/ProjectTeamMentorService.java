package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffAssignmentRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassStaffRoleType;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClass;
import com.example.starter_project_2025.system.project.trainingclass.TrainingClassRepository;
import com.example.starter_project_2025.system.rbac.user.User;
import com.example.starter_project_2025.system.rbac.user.UserRepository;
import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.slf4j.MDC;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectTeamMentorService {

    private final TrainingClassRepository trainingClassRepository;
    private final ClassStaffAssignmentRepository staffAssignmentRepository;
    private final UserRepository userRepository;
    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final ProjectTeamAuditRepository auditRepository;
    private final ProjectTeamOutboxRepository outboxRepository;
    private final ObjectMapper objectMapper;

    @Transactional(readOnly = true)
    public List<MentorOptionResponse> getMentors(
            Long classId,
            Authentication authentication
    ) {
        TrainingClass trainingClass = trainingClassRepository.findById(classId)
                .filter(value -> Boolean.TRUE.equals(value.getIsActive()))
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TrainingClass", "id", classId));
        scopeAuthorizationService.assertCanManageTeamMentor(authentication, trainingClass);
        return mentorOptions(trainingClass);
    }

    @Transactional(readOnly = true)
    public void validateMentor(TrainingClass trainingClass, Long mentorId) {
        if (mentorId == null) {
            return;
        }
        User mentor = userRepository.findByIdAndIsActiveTrue(mentorId)
                .orElseThrow(InvalidMentorForClassException::new);
        boolean assignedToClass =
                staffAssignmentRepository.existsByTrainingClass_IdAndUser_IdAndRoleTypeAndIsActiveTrue(
                        trainingClass.getId(), mentorId, ClassStaffRoleType.MENTOR);
        if (!assignedToClass && !mentorId.equals(trainingClass.getMentorId())) {
            throw new InvalidMentorForClassException();
        }
        if (!Boolean.TRUE.equals(mentor.getIsActive())) {
            throw new InvalidMentorForClassException();
        }
    }

    @Transactional(readOnly = true)
    public String getMentorName(Long mentorId) {
        if (mentorId == null) {
            return null;
        }
        return userRepository.findById(mentorId)
                .map(User::getFullName)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public Long resolveMentorForPublish(ProjectTeam team) {
        Long mentorId = team.getAssignedMentorId();
        if (mentorId == null) {
            mentorId = team.getTrainingClass().getMentorId();
            if (mentorId == null) {
                throw new TeamPublishValidationException(
                        "Nhóm chưa được gán Mentor và lớp học chưa có Mentor mặc định.");
            }
        }
        try {
            validateMentor(team.getTrainingClass(), mentorId);
        } catch (InvalidMentorForClassException invalidMentor) {
            throw new TeamPublishValidationException(InvalidMentorForClassException.MESSAGE);
        }
        return mentorId;
    }

    @Transactional
    public void updateTeamMentor(
            Long classId,
            Long sessionId,
            Long teamId,
            UpdateTeamMentorRequest request,
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
            throw new BadRequestException("Allocation session cannot be edited");
        }
        ProjectTeam team = teamRepository.findByIdAndAllocationSession_Id(teamId, sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "ProjectTeam", "id", teamId));
        if (team.getStatus() != ProjectTeamStatus.ACTIVE
                && team.getStatus() != ProjectTeamStatus.DRAFT) {
            throw new BadRequestException("Only DRAFT or ACTIVE teams can change mentors");
        }
        if (team.getStatus() == ProjectTeamStatus.ACTIVE
                && request.assignedMentorId() == null) {
            throw new InvalidMentorForClassException();
        }
        if (team.getStatus() == ProjectTeamStatus.ACTIVE
                && (request.reason() == null || request.reason().isBlank())) {
            throw new BadRequestException("Lý do thay đổi Mentor là bắt buộc.");
        }
        validateMentor(team.getTrainingClass(), request.assignedMentorId());

        Long previousMentorId = team.getAssignedMentorId();
        if (java.util.Objects.equals(previousMentorId, request.assignedMentorId())) {
            return;
        }
        team.setAssignedMentorId(request.assignedMentorId());
        teamRepository.saveAndFlush(team);

        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String correlationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        if (correlationId == null || correlationId.isBlank()) {
            correlationId = UUID.randomUUID().toString();
        }
        String beforeState = serialize(new MentorAuditState(previousMentorId, null));
        String afterState = serialize(new MentorAuditState(
                request.assignedMentorId(),
                request.reason() == null ? null : request.reason().trim()));
        auditRepository.save(ProjectTeamAudit.builder()
                .action(team.getStatus() == ProjectTeamStatus.ACTIVE
                        ? "UPDATE_ACTIVE_TEAM_MENTOR"
                        : "UPDATE_DRAFT_TEAM_MENTOR")
                .actorId(actorId)
                .classId(classId)
                .allocationSessionId(sessionId)
                .beforeState(beforeState)
                .afterState(afterState)
                .correlationId(correlationId)
                .build());
        outboxRepository.save(ProjectTeamOutboxEvent.builder()
                .eventType(team.getStatus() == ProjectTeamStatus.ACTIVE
                        ? "PROJECT_TEAM_MENTOR_UPDATED"
                        : "PROJECT_TEAM_DRAFT_MENTOR_UPDATED")
                .aggregateId(teamId)
                .payload(afterState)
                .correlationId(correlationId)
                .status("PENDING")
                .build());
    }

    private List<MentorOptionResponse> mentorOptions(TrainingClass trainingClass) {
        LinkedHashMap<Long, MentorOptionResponse> mentors = new LinkedHashMap<>();
        staffAssignmentRepository.findAllByTrainingClass_IdAndRoleTypeAndIsActiveTrueOrderByUser_FirstNameAsc(
                        trainingClass.getId(), ClassStaffRoleType.MENTOR)
                .stream()
                .filter(assignment -> Boolean.TRUE.equals(assignment.getUser().getIsActive()))
                .forEach(assignment -> mentors.put(
                        assignment.getUser().getId(),
                        new MentorOptionResponse(
                                assignment.getUser().getId(),
                                assignment.getUser().getFullName(),
                                assignment.getUser().getId()
                                        .equals(trainingClass.getMentorId()))));
        if (trainingClass.getMentorId() != null) {
            userRepository.findByIdAndIsActiveTrue(trainingClass.getMentorId())
                    .ifPresent(mentor -> mentors.putIfAbsent(
                            mentor.getId(),
                            new MentorOptionResponse(
                                    mentor.getId(), mentor.getFullName(), true)));
        }
        return new ArrayList<>(mentors.values());
    }

    private String serialize(MentorAuditState state) {
        try {
            return objectMapper.writeValueAsString(state);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize team mentor audit", exception);
        }
    }

    private record MentorAuditState(
            @JsonProperty("mentor_id") Long mentorId,
            String reason
    ) {
    }
}
