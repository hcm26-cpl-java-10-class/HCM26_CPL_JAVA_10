package com.example.starter_project_2025.system.project.task.reminder;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.UUID;
public final class MemberReminderData {
    private MemberReminderData(){}
    @Entity(name="MemberReminderBatch")
    @Table(name="member_reminder_batches",uniqueConstraints=@UniqueConstraint(name="uk_reminder_actor_request",columnNames={"actor_id","request_id"}))
    @Getter @Setter @NoArgsConstructor
    public static class Batch {
        @Id private UUID id;
        @Column(nullable=false) private UUID projectId;
        @Column(nullable=false) private Long tenantId;
        @Column(name="actor_id",nullable=false) private Long actorId;
        @Column(name="request_id",nullable=false) private UUID requestId;
        @Column(nullable=false,length=64) private String requestHash;
        @Column(nullable=false,length=500) private String warningNote;
        @Column(nullable=false) private int recipientCount;
        @Column(nullable=false) private Instant createdAt;
        @Column(nullable=false,length=100) private String correlationId;
    }
    @Entity(name="MemberReminderItem")
    @Table(name="member_reminder_items",uniqueConstraints=@UniqueConstraint(name="uk_reminder_batch_recipient",columnNames={"batch_id","recipient_user_id"}),
        indexes=@Index(name="idx_reminder_recipient",columnList="recipient_user_id"))
    @Getter @Setter @NoArgsConstructor
    public static class Item {
        @Id private UUID id;
        @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="batch_id",nullable=false) private Batch batch;
        @Column(name="recipient_user_id",nullable=false) private Long recipientUserId;
    }
    @Entity(name="MemberReminderAudit") @Table(name="member_reminder_audits")
    @Getter @Setter @NoArgsConstructor
    public static class Audit {
        @Id private UUID id;
        @Column(nullable=false) private UUID projectId;
        @Column(nullable=false) private UUID batchId;
        @Column(nullable=false) private Long actorId;
        @Column(nullable=false,length=50) private String action;
        @Column(nullable=false) private Instant occurredAt;
        @Column(nullable=false,length=100) private String correlationId;
        @Column(nullable=false,columnDefinition="TEXT") private String beforeState;
        @Column(nullable=false,columnDefinition="TEXT") private String afterState;
    }
    /** Only populated by local demo fixtures or an explicit integration mock in tests. */
    @Entity(name="MemberReminderContributionMock") @Table(name="member_reminder_contribution_mocks")
    @Getter @Setter @NoArgsConstructor
    public static class ContributionMock {
        @Id private UUID id;
        @Column(nullable=false) private UUID projectId;
        @Column(nullable=false) private Long actorId;
        @Column(nullable=false,length=30) private String kind;
        @Column(nullable=false) private Instant occurredAt;
    }
    @Entity(name="MemberReminderDemoDataset") @Table(name="member_reminder_demo_datasets")
    @Getter @Setter @NoArgsConstructor
    public static class DemoDataset {
        @Id private Long tenantId;
        @Column(nullable=false) private UUID projectId;
    }
}
