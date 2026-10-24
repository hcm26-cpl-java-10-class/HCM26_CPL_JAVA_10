package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ClassMember;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberRepository;
import com.example.starter_project_2025.system.project.trainingclass.ClassMemberStatus;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ProjectTeamPublishCoordinator {

    private static final String OPERATION = "PUBLISH_TEAMS";

    private final TeamAllocationSessionRepository sessionRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final TeamPublishItemService publishItemService;
    private final TeamAllocationSessionStateService sessionStateService;
    private final IdempotencyStore idempotencyStore;
    private final ObjectMapper objectMapper;
    private final Validator validator;
    private final ClassMemberRepository classMemberRepository;
    private final ProjectMemberRepository projectMemberRepository;

    @Transactional
    public ResponseEntity<String> publish(
            Long classId,
            Long sessionId,
            String key,
            PublishTeamsRequest request,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findByIdForUpdate(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        if (!session.getTrainingClass().getId().equals(classId)) {
            throw new ResourceNotFoundException("TeamAllocationSession", "classId", classId);
        }
        scopeAuthorizationService.assertCanManageClass(
                authentication, session.getTrainingClass());

        if (key == null || key.isBlank() || key.length() > 128) {
            return errorResponse(400, "ERR_INVALID_BATCH_DATA",
                    "X-Idempotency-Key is required and must not exceed 128 characters");
        }

        if (request == null) {
            return errorResponse(400, "ERR_INVALID_BATCH_DATA", "Request body is required");
        }
        Set<ConstraintViolation<PublishTeamsRequest>> violations = validator.validate(request);
        if (!violations.isEmpty()) {
            return errorResponse(400, "ERR_INVALID_BATCH_DATA",
                    violations.stream().map(ConstraintViolation::getMessage)
                            .sorted().findFirst().orElse("Invalid publish request"));
        }
        if (new HashSet<>(request.teamIds()).size() != request.teamIds().size()) {
            return errorResponse(400, "ERR_INVALID_BATCH_DATA",
                    "Duplicate team IDs are not allowed");
        }
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            return errorResponse(400, "ERR_INVALID_BATCH_DATA", "Allocation session is not open");
        }

        List<Long> activeMemberIds = classMemberRepository
                .findAllByTrainingClass_IdAndStatusOrderByIdAsc(
                        classId, ClassMemberStatus.ACTIVE)
                .stream()
                .map(ClassMember::getId)
                .toList();
        Set<Long> assignedMemberIds = projectMemberRepository
                .findAssignedMemberIdsBySessionAndTeamStatuses(
                        sessionId, List.of(ProjectTeamStatus.DRAFT, ProjectTeamStatus.ACTIVE))
                .stream()
                .collect(Collectors.toSet());
        List<Long> unassignedMemberIds = activeMemberIds.stream()
                .filter(memberId -> !assignedMemberIds.contains(memberId))
                .toList();
        if (!unassignedMemberIds.isEmpty()) {
            String message = "Không thể công bố. Còn " + unassignedMemberIds.size()
                    + " học viên chưa được xếp nhóm. Vui lòng phân nhóm cho toàn bộ học viên trước khi công bố";
            return unassignedMembersResponse(unassignedMemberIds, message);
        }

        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String requestHash = hash(new PublishPayload(sessionId, request));
        IdempotencyRecord record;
        try {
            record = idempotencyStore.claim(actorId, OPERATION, key, requestHash);
        } catch (DataIntegrityViolationException concurrentClaim) {
            record = idempotencyStore.find(actorId, OPERATION, key);
            return replayOrConflict(record, requestHash);
        }
        if (record.getStatus() == IdempotencyStatus.COMPLETED) {
            return replayOrConflict(record, requestHash);
        }

        try {
            List<Long> succeeded = new ArrayList<>();
            List<PublishTeamsResponse.FailedItem> failed = new ArrayList<>();
            for (Long teamId : request.teamIds()) {
                try {
                    publishItemService.publish(sessionId, teamId, actorId);
                    succeeded.add(teamId);
                } catch (StudentAlreadyAssignedException conflict) {
                    failed.add(new PublishTeamsResponse.FailedItem(
                            teamId,
                            "ERR_STUDENT_ALREADY_ASSIGNED",
                            conflict.getMessage(),
                            conflict.getMemberId(),
                            conflict.getConflictingTeamId()
                    ));
                } catch (ResourceNotFoundException missing) {
                    failed.add(new PublishTeamsResponse.FailedItem(
                            teamId, "ERR_TEAM_NOT_FOUND", missing.getMessage(), null, null));
                } catch (TeamPublishValidationException invalid) {
                    failed.add(new PublishTeamsResponse.FailedItem(
                            teamId, "ERR_STALE_DATA_CONFLICT", invalid.getMessage(), null, null));
                }
            }
            if (failed.isEmpty()) {
                sessionStateService.closeAsPublishedWhenNoDrafts(sessionId);
            }

            PublishTeamsResponse response =
                    new PublishTeamsResponse(sessionId, succeeded, failed);
            String body = writeJson(response);
            idempotencyStore.complete(record.getId(), 200, body);
            return ResponseEntity.ok().contentType(MediaType.APPLICATION_JSON).body(body);
        } catch (RuntimeException systemError) {
            idempotencyStore.releaseForRetry(record.getId());
            throw systemError;
        }
    }

    private ResponseEntity<String> cacheAndReturnError(
            IdempotencyRecord record,
            String code,
            String message
    ) {
        String body = writeJson(new TeamErrorResponse(
                400, code, message, null, null, LocalDateTime.now()));
        idempotencyStore.cacheClientError(record.getId(), 400, body);
        return ResponseEntity.badRequest()
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    private ResponseEntity<String> replayOrConflict(
            IdempotencyRecord record,
            String requestHash
    ) {
        if (!record.getRequestHash().equals(requestHash)) {
            throw new IdempotencyKeyConflictException();
        }
        if (record.getStatus() != IdempotencyStatus.COMPLETED
                || record.getHttpStatus() == null
                || record.getResponseBody() == null) {
            throw new IdempotencyRequestInProgressException();
        }
        return ResponseEntity.status(record.getHttpStatus())
                .contentType(MediaType.APPLICATION_JSON)
                .body(record.getResponseBody());
    }

    private ResponseEntity<String> errorResponse(int status, String code, String message) {
        String body = writeJson(new TeamErrorResponse(
                status, code, message, null, null, LocalDateTime.now()));
        return ResponseEntity.status(status)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    private ResponseEntity<String> unassignedMembersResponse(
            List<Long> unassignedMemberIds,
            String message
    ) {
        String body = writeJson(new PublishUnassignedMembersResponse(
                422,
                "ERR_UNASSIGNED_MEMBERS",
                message,
                unassignedMemberIds.size(),
                unassignedMemberIds,
                LocalDateTime.now()));
        return ResponseEntity.unprocessableEntity()
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    private String hash(Object value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256")
                    .digest(objectMapper.writeValueAsBytes(value));
            return HexFormat.of().formatHex(digest);
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Unable to fingerprint publish request", exception);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize publish response", exception);
        }
    }

    private record PublishPayload(Long sessionId, PublishTeamsRequest request) {
    }
}
