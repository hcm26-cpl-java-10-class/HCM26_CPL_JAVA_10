package com.example.starter_project_2025.system.project.alert;

import com.example.starter_project_2025.init.annotation.ResourceMenu;
import com.example.starter_project_2025.init.annotation.ResourcePermission;
import jakarta.persistence.*;
import lombok.*;
import java.time.Instant;
import java.util.*;
import static com.example.starter_project_2025.system.project.alert.ProjectAlertDtos.Kind;

public final class ProjectAlertData {
    private ProjectAlertData() { }
    @Entity(name="ProjectAlertBatch") @Table(name="project_alert_batches", uniqueConstraints=
            @UniqueConstraint(name="uk_project_alert_actor_request",columnNames={"actor_id","request_id"}),
            indexes=@Index(name="idx_project_alert_team_time",columnList="team_id,created_at"))
    @Getter @Setter @NoArgsConstructor
    @ResourcePermission("PROJECT_ALERT")
    @ResourceMenu(title="Alerts",group="Project Management",icon="bell",url="/management/alerts",order=6,permission="PROJECT_ALERT_READ")
    public static class Batch {
        @Id private UUID id;
        @Column(name="team_id",nullable=false,updatable=false) private Long teamId;
        @Column(name="project_id",updatable=false) private Long projectId;
        @Column(name="tenant_id",nullable=false,updatable=false) private Long tenantId;
        @Column(name="actor_id",nullable=false,updatable=false) private Long actorId;
        @Column(name="request_id",nullable=false,updatable=false) private UUID requestId;
        @Enumerated(EnumType.STRING) @Column(nullable=false,length=20,updatable=false) private Kind kind;
        @Column(nullable=false,length=64,updatable=false) private String requestHash;
        @Column(nullable=false,length=500,updatable=false) private String warningNote;
        @Column(nullable=false,updatable=false) private int recipientCount;
        @Column(name="created_at",nullable=false,updatable=false) private Instant createdAt;
        @Column(nullable=false,length=100,updatable=false) private String correlationId;
    }
    @Entity(name="ProjectAlertRecipient") @Table(name="project_alert_recipients",uniqueConstraints=
            @UniqueConstraint(name="uk_project_alert_recipient",columnNames={"batch_id","user_id"}))
    @Getter @Setter @NoArgsConstructor
    public static class Recipient {
        @Id private UUID id;
        @ManyToOne(fetch=FetchType.LAZY,optional=false) @JoinColumn(name="batch_id",nullable=false,updatable=false) private Batch batch;
        @Column(name="user_id",nullable=false,updatable=false) private Long userId;
    }
    @Entity(name="ProjectAlertAudit") @Table(name="project_alert_audits") @Getter @Setter @NoArgsConstructor
    public static class Audit {
        @Id private UUID id;
        @Column(nullable=false,updatable=false) private UUID batchId;
        @Column(nullable=false,updatable=false) private Long teamId;
        @Column(nullable=false,updatable=false) private Long actorId;
        @Column(nullable=false,length=100,updatable=false) private String action;
        @Column(nullable=false,updatable=false) private Instant occurredAt;
        @Column(nullable=false,length=100,updatable=false) private String correlationId;
        @Column(nullable=false,columnDefinition="TEXT",updatable=false) private String beforeState;
        @Column(nullable=false,columnDefinition="TEXT",updatable=false) private String afterState;
    }
    @Entity(name="AlertMilestoneBacklogConfig") @Table(name="alert_milestone_backlog_config")
    @Getter @Setter @NoArgsConstructor
    public static class MilestoneConfig {
        @Id private UUID milestoneId;
        @Column(nullable=false,updatable=false) private Long teamId;
        @Column(nullable=false,updatable=false) private Long tenantId;
        @Column(nullable=false) private Long configuredBy;
        @Column(nullable=false) private Instant configuredAt;
        private Instant migratedAt;
        @ElementCollection @CollectionTable(name="alert_milestone_backlog_items",joinColumns=@JoinColumn(name="milestone_id"),
                uniqueConstraints=@UniqueConstraint(name="uk_alert_milestone_backlog",columnNames={"milestone_id","backlog_item_id"}))
        @Column(name="backlog_item_id",nullable=false) private Set<Long> backlogItemIds=new HashSet<>();
    }
}
