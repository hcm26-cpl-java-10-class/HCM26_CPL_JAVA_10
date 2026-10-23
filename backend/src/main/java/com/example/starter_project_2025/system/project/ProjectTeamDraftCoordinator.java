package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.exception.BadRequestException;
import com.example.starter_project_2025.exception.ResourceNotFoundException;
import com.example.starter_project_2025.security.UserPrincipal;
import com.example.starter_project_2025.system.project.trainingclass.ScopeAuthorizationService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validator;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.HexFormat;
import java.util.Set;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ProjectTeamDraftCoordinator {

    private static final String OPERATION = "SAVE_DRAFT_TEAMS";

    private final TeamAllocationSessionRepository sessionRepository;
    private final ScopeAuthorizationService scopeAuthorizationService;
    private final IdempotencyStore idempotencyStore;
    private final ProjectTeamDraftService draftService;
    private final ObjectMapper objectMapper;
    private final Validator validator;

    public ResponseEntity<String> saveBatch(
            Long classId,
            Long sessionId,
            String idempotencyKey,
            BatchSaveDraftRequest request,
            Authentication authentication
    ) {
        authorize(classId, sessionId, authentication);
        validateIdempotencyKey(idempotencyKey);

        Long actorId = ((UserPrincipal) authentication.getPrincipal()).getUser().getId();
        String requestHash = hash(new IdempotencyPayload(sessionId, request));
        IdempotencyRecord record;

        try {
            record = idempotencyStore.claim(
                    actorId, OPERATION, idempotencyKey, requestHash);
        } catch (DataIntegrityViolationException concurrentClaim) {
            record = idempotencyStore.find(actorId, OPERATION, idempotencyKey);
            return replayOrConflict(record, requestHash);
        }

        if (record.getStatus() == IdempotencyStatus.COMPLETED) {
            return replayOrConflict(record, requestHash);
        }

        if (request == null) {
            String body = writeJson(new TeamErrorResponse(
                    400, "ERR_INVALID_BATCH_DATA", "Request body is required",
                    null, null, LocalDateTime.now()));
            idempotencyStore.cacheClientError(record.getId(), 400, body);
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body);
        }

        Set<ConstraintViolation<BatchSaveDraftRequest>> violations =
                validator.validate(request);
        if (!violations.isEmpty()) {
            TeamErrorResponse error = new TeamErrorResponse(
                    HttpStatus.BAD_REQUEST.value(),
                    "ERR_INVALID_BATCH_DATA",
                    violations.stream()
                            .map(ConstraintViolation::getMessage)
                            .sorted()
                            .findFirst()
                            .orElse("Invalid batch data"),
                    null,
                    null,
                    LocalDateTime.now()
            );
            String body = writeJson(error);
            idempotencyStore.cacheClientError(record.getId(), 400, body);
            return ResponseEntity.badRequest()
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body);
        }

        try {
            draftService.saveBatch(
                    sessionId,
                    request,
                    authentication,
                    record.getId()
            );
            IdempotencyRecord completed = idempotencyStore.find(
                    actorId, OPERATION, idempotencyKey);
            return ResponseEntity.status(completed.getHttpStatus())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(completed.getResponseBody());
        } catch (TeamCapacityExceededException | StudentAlreadyAssignedException
                 | BadRequestException | ResourceNotFoundException businessError) {
            ResponseEntity<TeamErrorResponse> mapped = mapBusinessError(businessError);
            idempotencyStore.cacheClientError(
                    record.getId(),
                    mapped.getStatusCode().value(),
                    writeJson(mapped.getBody())
            );
            return ResponseEntity.status(mapped.getStatusCode())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(writeJson(mapped.getBody()));
        } catch (RuntimeException systemError) {
            idempotencyStore.releaseForRetry(record.getId());
            throw systemError;
        }
    }

    private void authorize(
            Long classId,
            Long sessionId,
            Authentication authentication
    ) {
        TeamAllocationSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "TeamAllocationSession", "id", sessionId));
        if (!session.getTrainingClass().getId().equals(classId)) {
            throw new ResourceNotFoundException(
                    "TeamAllocationSession", "classId", classId);
        }
        scopeAuthorizationService.assertCanManageClass(
                authentication, session.getTrainingClass());
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

    private ResponseEntity<TeamErrorResponse> mapBusinessError(RuntimeException exception) {
        if (exception instanceof InvalidMentorForClassException) {
            return ResponseEntity.badRequest().body(new TeamErrorResponse(
                    400,
                    "ERR_INVALID_MENTOR_FOR_CLASS",
                    InvalidMentorForClassException.MESSAGE,
                    null,
                    null,
                    LocalDateTime.now()));
        }
        if (exception instanceof TeamCapacityExceededException capacityError) {
            return ResponseEntity.unprocessableEntity().body(new TeamErrorResponse(
                    422, "ERR_TEAM_CAPACITY_EXCEEDED", capacityError.getMessage(),
                    null, null, LocalDateTime.now()));
        }
        if (exception instanceof StudentAlreadyAssignedException conflict) {
            return ResponseEntity.status(HttpStatus.CONFLICT).body(new TeamErrorResponse(
                    409, "ERR_STUDENT_ALREADY_ASSIGNED",
                    conflict.getMessage(),
                    conflict.getMemberId(), conflict.getConflictingTeamId(),
                    LocalDateTime.now()));
        }
        if (exception instanceof ResourceNotFoundException) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).body(new TeamErrorResponse(
                    404, "ERR_RESOURCE_NOT_FOUND", exception.getMessage(),
                    null, null, LocalDateTime.now()));
        }
        return ResponseEntity.badRequest().body(new TeamErrorResponse(
                400, "ERR_INVALID_BATCH_DATA", exception.getMessage(),
                null, null, LocalDateTime.now()));
    }

    private void validateIdempotencyKey(String key) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new BadRequestException(
                    "X-Idempotency-Key is required and must not exceed 128 characters");
        }
    }

    private String hash(Object value) {
        try {
            byte[] serialized = objectMapper.writeValueAsBytes(value);
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(serialized);
            return HexFormat.of().formatHex(digest);
        } catch (JsonProcessingException | NoSuchAlgorithmException exception) {
            throw new IllegalStateException("Unable to fingerprint batch request", exception);
        }
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Unable to serialize response", exception);
        }
    }

    private record IdempotencyPayload(
            Long sessionId,
            BatchSaveDraftRequest request
    ) {
    }
}
