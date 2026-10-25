package com.example.starter_project_2025.system.project;

import com.example.starter_project_2025.base.crud.domain.BaseCrudRepository;
import java.time.Instant;
import java.util.Optional;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface IdempotencyRecordRepository
        extends BaseCrudRepository<IdempotencyRecord, Long> {

    Optional<IdempotencyRecord>
    findByActorIdAndOperationAndIdempotencyKey(
            Long actorId,
            String operation,
            String idempotencyKey
    );

    long deleteByExpiresAtBefore(Instant now);


    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
        select r
        from IdempotencyRecord r
        where r.actorId = :actorId
          and r.operation = :operation
          and r.idempotencyKey = :idempotencyKey
        """)
    Optional<IdempotencyRecord> findForUpdate(
            @Param("actorId") Long actorId,
            @Param("operation") String operation,
            @Param("idempotencyKey") String idempotencyKey
    );
}
