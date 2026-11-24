package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface GitWebhookEventRepository extends JpaRepository<GitWebhookEvent, Long>, JpaSpecificationExecutor<GitWebhookEvent> {

    boolean existsByProviderAndDeliveryId(GitProvider provider, String deliveryId);

    Optional<GitWebhookEvent> findByProviderAndDeliveryId(GitProvider provider, String deliveryId);

    /**
     * SY-04 AC06: locks the event row when it can still be run, skipping it (empty
     * result, no waiting) when another worker holds the lock. Works on MySQL 8+ and
     * H2 2.x. Must run inside the claiming transaction.
     */
    @Query(value = """
            SELECT id FROM git_webhook_events
             WHERE id = :id
               AND status IN ('RECEIVED', 'FAILED_RETRYABLE')
               AND next_attempt_at <= :now
             FOR UPDATE SKIP LOCKED""", nativeQuery = true)
    List<Number> lockRunnable(@Param("id") Long id, @Param("now") LocalDateTime now);

    /**
     * SY-04 fallback scheduler: RECEIVED events older than the grace period (the fast
     * path did not take them) and FAILED_RETRYABLE events whose retry time has come.
     */
    @Query("""
            select e.id from GitWebhookEvent e
            where e.eventType in :eventTypes
              and ((e.status = :received and e.nextAttemptAt <= :graceCutoff)
                or (e.status = :retryable and e.nextAttemptAt <= :now))
            order by e.nextAttemptAt asc, e.id asc""")
    List<Long> findDueIds(@Param("eventTypes") Collection<String> eventTypes,
                          @Param("received") GitWebhookEventStatus received,
                          @Param("retryable") GitWebhookEventStatus retryable,
                          @Param("graceCutoff") LocalDateTime graceCutoff,
                          @Param("now") LocalDateTime now, Pageable page);

    /** PROCESSING events whose worker vanished. */
    @Query("select e.id from GitWebhookEvent e where e.status = :status and e.processingStartedAt < :before")
    List<Long> findStuckIds(@Param("status") GitWebhookEventStatus status, @Param("before") LocalDateTime before, Pageable page);

    /** Retention: drops payloads of finished events older than {@code before}; the rows stay for the audit trail. */
    @Modifying
    @Query("""
            update GitWebhookEvent e set e.payload = null, e.payloadPurgedAt = :now
            where e.receivedAt < :before and e.payload is not null and e.status in :statuses""")
    int purgePayloads(@Param("before") LocalDateTime before, @Param("now") LocalDateTime now,
                      @Param("statuses") Collection<GitWebhookEventStatus> statuses);

    /** SY-04 activity: events of a GitHub repository still waiting or retrying (resolved or not). */
    long countByRepoExternalIdAndStatusIn(Long repoExternalId, Collection<GitWebhookEventStatus> statuses);

    /** SY-04 activity: events of one repository connection in a status, e.g. FAILED. */
    long countByRepository_IdAndStatus(Long repositoryRef, GitWebhookEventStatus status);

    /** SY-04 activity: arrival of the newest processed event of a repository connection. */
    @Query("select max(e.receivedAt) from GitWebhookEvent e where e.repository.id = :repositoryId and e.status = :status")
    LocalDateTime lastReceivedAt(@Param("repositoryId") Long repositoryId, @Param("status") GitWebhookEventStatus status);
}
