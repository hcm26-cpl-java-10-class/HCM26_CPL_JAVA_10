package com.example.starter_project_2025.system.project;

import java.time.Duration;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class IdempotencyStore {

    private static final Duration PROCESSING_LEASE = Duration.ofMinutes(2);
    private static final Duration COMPLETED_TTL = Duration.ofHours(24);

    private final IdempotencyRecordRepository repository;

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public IdempotencyRecord claim(
            Long actorId,
            String operation,
            String key,
            String requestHash
    ) {
        Instant now = Instant.now();

        IdempotencyRecord record = repository
                .findForUpdate(actorId, operation, key)
                .orElseGet(() -> IdempotencyRecord.builder()
                        .actorId(actorId)
                        .operation(operation)
                        .idempotencyKey(key)
                        .requestHash(requestHash)
                        .status(IdempotencyStatus.PROCESSING)
                        .expiresAt(now.plus(PROCESSING_LEASE))
                        .build());

        if (record.getId() != null && record.getExpiresAt().isAfter(now)) {
            if (!record.getRequestHash().equals(requestHash)) {
                throw new IdempotencyKeyConflictException();
            }

            if (record.getStatus() == IdempotencyStatus.COMPLETED) {
                return record;
            }

            throw new IdempotencyRequestInProgressException();
        }

        record.setRequestHash(requestHash);
        record.setStatus(IdempotencyStatus.PROCESSING);
        record.setHttpStatus(null);
        record.setResponseBody(null);
        record.setExpiresAt(now.plus(PROCESSING_LEASE));

        return repository.saveAndFlush(record);
    }

    @Transactional(readOnly = true, propagation = Propagation.REQUIRES_NEW)
    public IdempotencyRecord find(
            Long actorId,
            String operation,
            String key
    ) {
        return repository.findByActorIdAndOperationAndIdempotencyKey(
                        actorId, operation, key)
                .orElseThrow(IdempotencyRequestInProgressException::new);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void cacheClientError(Long recordId, int status, String responseBody) {
        IdempotencyRecord record = repository.findById(recordId).orElseThrow();
        record.setStatus(IdempotencyStatus.COMPLETED);
        record.setHttpStatus(status);
        record.setResponseBody(responseBody);
        record.setExpiresAt(Instant.now().plus(COMPLETED_TTL));
        repository.save(record);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void complete(Long recordId, int status, String responseBody) {
        IdempotencyRecord record = repository.findById(recordId).orElseThrow();
        record.setStatus(IdempotencyStatus.COMPLETED);
        record.setHttpStatus(status);
        record.setResponseBody(responseBody);
        record.setExpiresAt(Instant.now().plus(COMPLETED_TTL));
        repository.save(record);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void releaseForRetry(Long recordId) {
        repository.deleteById(recordId);
    }
}