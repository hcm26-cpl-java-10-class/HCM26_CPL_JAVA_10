package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
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
    private static final String SESSION_OPERATION = "PUBLISH_ALLOCATION_SESSION";

    private final TeamAllocationSessionRepository sessionRepository;
    private final ProjectTeamRepository teamRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final TeamPublishItemService publishItemService;
    private final TeamAllocationSessionStateService sessionStateService;
    private final AllocationReadinessService readinessService;
    private final IdempotencyStore idempotencyStore;
    private final ObjectMapper objectMapper;
    private final Validator validator;

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

        AllocationReadinessResponse readiness = readinessService.evaluateSession(sessionId);
        if (!readiness.unassignedStudents().isEmpty()) {
            String message = "Không thể công bố. Còn " + readiness.unassignedStudentCount()
                    + " học viên chưa được xếp nhóm. Vui lòng phân nhóm cho toàn bộ học viên trước khi công bố";
            return blockedResponse(
                    readiness, AllocationReadinessService.ERR_UNASSIGNED_MEMBERS, message);
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
                    publishItemService.publish(
                            sessionId, teamId, actorId, authentication);
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

    /**
     * US-12: returns the HTTP 422 body with the free students (ids + names) and
     * every team readiness issue so the UI can highlight them.
     */
    private ResponseEntity<String> blockedResponse(
            AllocationReadinessResponse readiness,
            String errorCode,
            String message
    ) {
        String body = writeJson(PublishReadinessErrorResponse.from(
                readiness, errorCode, message));
        return ResponseEntity.unprocessableEntity()
                .contentType(MediaType.APPLICATION_JSON)
                .body(body);
    }

    /**
     * US-12: publishes the whole allocation session in one strict operation.
     * <p>
     * The request only contains the idempotency key — the team list is taken
     * from the session. Strict mode blocks the operation with HTTP 422 when
     * the class still has free students, any team has no valid template, or a
     * team violates its template role quotas.
     */
    @Transactional
    public ResponseEntity<String> publishSession(
            Long classId,
            Long sessionId,
            String key,
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
        if (session.getStatus() != TeamAllocationSessionStatus.OPEN) {
            return errorResponse(400, "ERR_INVALID_BATCH_DATA", "Allocation session is not open");
        }

        AllocationReadinessResponse readiness = readinessService.evaluateSession(sessionId);
        if (!readiness.readyToPublish()) {
            String message = readiness.unassignedStudentCount() > 0
                    ? "Không thể công bố. Còn " + readiness.unassignedStudentCount()
                            + " học viên chưa được xếp nhóm. Vui lòng phân nhóm cho toàn bộ học viên trước khi công bố"
                    : "Không thể công bố. Còn " + readiness.teamIssues().size()
                            + " lỗi điều kiện nhóm (đề bài/vai trò). Vui lòng xử lý toàn bộ trước khi công bố";
            String errorCode = readiness.unassignedStudentCount() > 0
                    ? AllocationReadinessService.ERR_UNASSIGNED_MEMBERS
                    : AllocationReadinessService.ERR_TEAMS_NOT_READY;
            return blockedResponse(readiness, errorCode, message);
        }

        List<Long> teamIds = teamRepository
                .findAllByAllocationSession_IdAndStatusOrderByIdAsc(
                        sessionId, ProjectTeamStatus.DRAFT)
                .stream()
                .map(ProjectTeam::getId)
                .toList();
        if (teamIds.isEmpty()) {
            return errorResponse(400, "ERR_INVALID_BATCH_DATA",
                    "Allocation session has no DRAFT teams to publish");
        }

        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String requestHash = hash(new PublishSessionPayload(sessionId, teamIds));
        IdempotencyRecord record;
        try {
            record = idempotencyStore.claim(actorId, SESSION_OPERATION, key, requestHash);
        } catch (DataIntegrityViolationException concurrentClaim) {
            record = idempotencyStore.find(actorId, SESSION_OPERATION, key);
            return replayOrConflict(record, requestHash);
        }
        if (record.getStatus() == IdempotencyStatus.COMPLETED) {
            return replayOrConflict(record, requestHash);
        }

        try {
            List<Long> succeeded = new ArrayList<>();
            List<PublishTeamsResponse.FailedItem> failed = new ArrayList<>();
            for (Long teamId : teamIds) {
                try {
                    publishItemService.publish(
                            sessionId, teamId, actorId, authentication);
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

    private record PublishSessionPayload(Long sessionId, List<Long> teamIds) {
    }
}
