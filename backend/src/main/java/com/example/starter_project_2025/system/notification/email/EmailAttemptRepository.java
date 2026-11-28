package com.example.starter_project_2025.system.notification.email;

import com.example.starter_project_2025.system.notification.NotificationCategory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

public interface EmailAttemptRepository extends JpaRepository<EmailAttempt, Long> {

    Optional<EmailAttempt> findByIdempotencyKey(String idempotencyKey);

    List<EmailAttempt> findByBatchIdOrderByIdAsc(String batchId);

    List<EmailAttempt> findTop50ByDeliveryStatusAndNextRetryAtLessThanEqualOrderByNextRetryAtAsc(
            EmailDeliveryStatus status,
            LocalDateTime now
    );

    @Query("""
            select a from EmailAttempt a
            where (:tenantId is null or a.tenantId = :tenantId or a.tenantId is null)
              and (:restrictActorId is null or a.createdByUserId = :restrictActorId or a.createdByUserId is null)
              and (:contextRef is null or lower(a.contextRef) like lower(concat('%', :contextRef, '%')))
              and (:recipient is null or lower(a.recipientEmail) like lower(concat('%', :recipient, '%')))
              and (:status is null or a.deliveryStatus = :status)
              and (:category is null or a.category = :category)
              and (:fromDate is null or a.createdAt >= :fromDate)
              and (:toDate is null or a.createdAt <= :toDate)
            """)
    Page<EmailAttempt> searchHistory(
            @Param("tenantId") Long tenantId,
            @Param("restrictActorId") Long restrictActorId,
            @Param("contextRef") String contextRef,
            @Param("recipient") String recipient,
            @Param("status") EmailDeliveryStatus status,
            @Param("category") NotificationCategory category,
            @Param("fromDate") LocalDateTime fromDate,
            @Param("toDate") LocalDateTime toDate,
            Pageable pageable
    );
}
