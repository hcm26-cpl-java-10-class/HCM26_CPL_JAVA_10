package com.example.starter_project_2025.system.project.task.alert;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import java.time.Instant;
import java.util.UUID;

/** Bridge IDs are aliases; they never change the primary keys owned by other modules. */
public final class TaskAlertData {
    private TaskAlertData() { }
    public enum MemberSource { TEAM_MEMBER, PROJECT_MEMBER }
    public enum DeliveryStatus { PENDING, DELIVERED, FAILED }

    @Entity(name = "TaskAlertProjectLink") @Table(name = "task_alert_project_links")
    @Getter @Setter @NoArgsConstructor
    public static class ProjectLink {
        @Id private UUID id;
        @Column(nullable = false, unique = true) private Long projectId;
        @Column(nullable = false) private Long tenantId;
    }

    @Entity(name = "TaskAlertMemberLink")
    @Table(name = "task_alert_member_links", uniqueConstraints = @UniqueConstraint(
            name = "uk_alert_source_member", columnNames = {"source", "source_member_id"}))
    @Getter @Setter @NoArgsConstructor
    public static class MemberLink {
        @Id private UUID id;
        @Column(nullable = false) private UUID projectId;
        @Enumerated(EnumType.STRING) @Column(nullable = false) private MemberSource source;
        @Column(name = "source_member_id", nullable = false) private Long sourceMemberId;
    }

    @Entity(name = "TaskAlertBatch")
    @Table(name = "task_alert_batches", uniqueConstraints = @UniqueConstraint(
            name = "uk_alert_actor_request", columnNames = {"actor_id", "request_id"}))
    @Getter @Setter @NoArgsConstructor
    public static class Batch {
        @Id private UUID id;
        @Column(nullable = false) private UUID projectId;
        @Column(nullable = false) private Long tenantId;
        @Column(name = "actor_id", nullable = false) private Long actorId;
        @Column(name = "request_id", nullable = false) private UUID requestId;
        @Column(nullable = false, length = 64) private String requestHash;
        @Column(nullable = false, length = 500) private String warningNote;
        @Column(nullable = false, length = 100) private String correlationId;
        @Column(nullable = false) private Instant createdAt;
        @Column(nullable = false) private int taskCount;
        @Column(nullable = false) private int recipientCount;
    }

    @Entity(name = "TaskAlertItem")
    @Table(name = "task_alert_items", uniqueConstraints = @UniqueConstraint(
            name = "uk_alert_batch_task", columnNames = {"batch_id", "task_id"}),
            indexes = @Index(name = "idx_alert_task", columnList = "task_id"))
    @Getter @Setter @NoArgsConstructor
    public static class Item {
        @Id private UUID id;
        @ManyToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "batch_id", nullable = false) private Batch batch;
        @Column(name = "task_id", nullable = false) private UUID taskId;
        @Column(nullable = false) private UUID assigneeId;
        @Column(nullable = false) private Long recipientUserId;
    }

    @Entity(name = "TaskAlertOutbox")
    @Table(name = "task_alert_outbox", uniqueConstraints = @UniqueConstraint(
            name = "uk_alert_outbox_batch", columnNames = "batch_id"))
    @Getter @Setter @NoArgsConstructor
    public static class Outbox {
        @Id private UUID id;
        @OneToOne(fetch = FetchType.LAZY, optional = false)
        @JoinColumn(name = "batch_id", nullable = false) private Batch batch;
        @Column(nullable = false, length = 60) private String eventType;
        @Column(nullable = false, columnDefinition = "TEXT") private String payload;
        @Enumerated(EnumType.STRING) @Column(nullable = false, length = 20)
        private DeliveryStatus status = DeliveryStatus.PENDING;
        @Column(nullable = false) private Instant createdAt;
        private Instant deliveredAt;
    }
}
