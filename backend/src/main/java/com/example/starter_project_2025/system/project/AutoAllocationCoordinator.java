package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.security.UserPrincipal;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AutoAllocationCoordinator {
    private static final String OPERATION = "AUTO_ALLOCATION_CONFIRM";
    private final AutoAllocationService service;
    private final IdempotencyStore idempotency;
    private final ObjectMapper mapper;

    public ResponseEntity<String> confirm(Long classId, Long sessionId, String key,
            AutoAllocationConfirmRequest request, Authentication actor) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new AutoAllocationException(HttpStatus.BAD_REQUEST, "ERR_INVALID_IDEMPOTENCY_KEY",
                    "X-Idempotency-Key không hợp lệ.");
        }
        Long actorId = ((UserPrincipal) actor.getPrincipal()).getUser().getId();
        String hash = digest(classId + ":" + sessionId + ":" + json(request));
        IdempotencyRecord record;
        boolean newClaim = true;
        try {
            record = idempotency.claim(actorId, OPERATION, key, hash);
        } catch (DataIntegrityViolationException concurrentClaim) {
            record = idempotency.find(actorId, OPERATION, key);
            newClaim = false;
        }
        if (record.getStatus() == IdempotencyStatus.COMPLETED) {
            if (!record.getRequestHash().equals(hash)) throw new IdempotencyKeyConflictException();
            return ResponseEntity.status(record.getHttpStatus()).contentType(MediaType.APPLICATION_JSON)
                    .body(record.getResponseBody());
        }
        if (!record.getRequestHash().equals(hash)) throw new IdempotencyKeyConflictException();
        if (!newClaim || record.getStatus() != IdempotencyStatus.PROCESSING) {
            throw new IdempotencyRequestInProgressException();
        }
        try {
            String body = json(service.confirm(classId, sessionId, request, actor));
            idempotency.complete(record.getId(), 201, body);
            return ResponseEntity.status(HttpStatus.CREATED).contentType(MediaType.APPLICATION_JSON).body(body);
        } catch (RuntimeException failure) {
            idempotency.releaseForRetry(record.getId());
            throw failure;
        }
    }

    private String json(Object value) {
        try { return mapper.writeValueAsString(value); }
        catch (JsonProcessingException exception) { throw new IllegalStateException(exception); }
    }

    private String digest(String source) {
        try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                .digest(source.getBytes(StandardCharsets.UTF_8))); }
        catch (NoSuchAlgorithmException exception) { throw new IllegalStateException(exception); }
    }
}
