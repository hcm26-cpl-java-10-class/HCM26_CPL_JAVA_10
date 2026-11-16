package com.example.starter_project_2025.system.git_integration.repository;

import com.example.starter_project_2025.system.git_integration.domain.GitProvider;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEvent;
import com.example.starter_project_2025.system.git_integration.domain.GitWebhookEventStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface GitWebhookEventRepository extends JpaRepository<GitWebhookEvent, Long> {

    boolean existsByProviderAndDeliveryId(GitProvider provider, String deliveryId);

    Optional<GitWebhookEvent> findByProviderAndDeliveryId(GitProvider provider, String deliveryId);

    /** RECEIVED/FAILED events of the given types whose time has come, oldest first. */
    @Query("""
            select e.id from GitWebhookEvent e
            where e.status in :statuses and e.eventType in :eventTypes and e.nextAttemptAt <= :now
            order by e.nextAttemptAt asc, e.id asc""")
    List<Long> findDueIds(@Param("statuses") Collection<GitWebhookEventStatus> statuses,
                          @Param("eventTypes") Collection<String> eventTypes,
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
}
