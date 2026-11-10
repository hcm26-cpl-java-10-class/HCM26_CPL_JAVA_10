package com.example.starter_project_2025.system.project.workspace.domain;

import com.example.starter_project_2025.base.crud.domain.BaseEntity;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.CascadeType;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "project_logs", indexes = {
        @Index(name = "idx_project_logs_project_type_created", columnList = "project_id, log_type, created_at"),
        @Index(name = "idx_project_logs_workspace", columnList = "workspace_id")
})
@Getter
@Setter
@NoArgsConstructor
public class ProjectLog extends BaseEntity {
    @Column(name = "workspace_id", nullable = false)
    private Long workspaceId;

    @Column(name = "tenant_id", nullable = false)
    private Long tenantId;

    @Column(name = "project_id")
    private Long projectId;

    @Column(name = "team_id", nullable = false)
    private Long teamId;

    @Enumerated(EnumType.STRING)
    @Column(name = "log_type", nullable = false, length = 20)
    private ProjectLogType type;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(columnDefinition = "TEXT")
    private String rationale;

    @Column(name = "impact_analysis", columnDefinition = "TEXT")
    private String impactAnalysis;

    @Column(nullable = false, length = 20)
    private String status;

    @Column(length = 20)
    private String category;

    @Column(length = 20)
    private String severity;

    @Column(columnDefinition = "TEXT")
    private String mitigationPlan;

    @Column(name = "meeting_date")
    private Instant meetingDate;

    @Deprecated
    @Column(name = "attendees", columnDefinition = "TEXT")
    private String legacyAttendees;

    @Column(name = "action_items", columnDefinition = "TEXT")
    private String actionItems;

    @OneToMany(mappedBy = "meetingNote", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.LAZY)
    private List<MeetingNoteAttendee> meetingNoteAttendees = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "target_type", length = 20)
    private ProjectLogTargetType targetType;

    // Milestone identifiers are UUIDs in the existing milestone module; all other target IDs are Long.
    @Column(name = "target_id", length = 36)
    private String targetId;

    @Column(name = "is_deleted", nullable = false)
    private boolean deleted;

    @Version
    @Column(nullable = false)
    private Long version = 0L;

    public void addMeetingNoteAttendee(MeetingNoteAttendee attendee) {
        meetingNoteAttendees.add(attendee);
    }
}
